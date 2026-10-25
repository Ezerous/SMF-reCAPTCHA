const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
// Extract the actual inline JavaScript from modification.xml, not a duplicated copy.
const xml = fs.readFileSync(__dirname + '/../modification.xml', 'utf8');
const templateStart = xml.indexOf('<file name="$themedir/Register.template.php">');
const jsStart = xml.indexOf('<script>', templateStart);
const jsEnd = xml.indexOf('</script>', jsStart);
assert(templateStart !== -1 && jsStart !== -1 && jsEnd > jsStart);
const phpInterpolation = `"', $modSettings['recaptchaSiteKey'], '"`;
const source = xml.substring(jsStart + '<script>'.length, jsEnd)
  .replace(phpInterpolation, '"MOCK_SITE_KEY"');
assert(!source.includes(phpInterpolation), 'Site key interpolation was not replaced');

function setup(opts = {}) {
  let executeCalls = 0, verifyCalls = 0, submitEvents = 0;
  let tokenCount = 0;
  const postRequests = [], errorMessages = [], alertMessages = [];
  const submitListeners = [], domReadyListeners = [], pageShowListeners = [];
  const timers = new Map();
  let nextTimerId = 1;
  let rejectGoogle = false;
  let googleBlocked = Boolean(opts.googleBlocked);
  let nativeValid = opts.nativeValid !== false;
  let button;
  const tokenField = {value: ''};

  const form = {
    smfRecaptchaInitialized: false,
    querySelector(selector) {
      if (selector === 'input[name=g-recaptcha-response]') return tokenField;
      if (selector.startsWith('input[type=submit]')) return button;
      throw new Error('Unexpected selector: ' + selector);
    },
    addEventListener(name, listener) {
      assert.strictEqual(name, 'submit');
      submitListeners.push(listener);
    },
    requestSubmit(submitter) {
      dispatchSubmit(submitter);
    }
  };
  button = {form, name:'regSubmit', click() { dispatchSubmit(button); }};
  if (opts.noRequestSubmit) form.requestSubmit = undefined;

  const window = {
    console: {error(...args) {errorMessages.push(args.map(String).join(' '));}},
    alert(message) {alertMessages.push(message)},
    setTimeout(callback) {const id = nextTimerId++; timers.set(id, callback); return id;},
    clearTimeout(id) {timers.delete(id);},
    addEventListener(name, callback) {
      assert.strictEqual(name, 'pageshow');
      pageShowListeners.push(callback);
    }
  };
  if (!googleBlocked) {
    window.grecaptcha = {
      ready(callback) {callback();},
      execute(key, options) {
        executeCalls++;
        assert.strictEqual(key, 'MOCK_SITE_KEY');
        assert.strictEqual(options.action, 'registration');
        if (opts.pendingGoogle) return new Promise(() => {});
        if (opts.rejectGoogle && tokenCount++ === 0) return Promise.reject(new Error('Google unavailable'));
        if (opts.emptyGoogleToken) return Promise.resolve('');
        return Promise.resolve('mock-token-' + (++tokenCount));
      }
    };
  }
  const document = {
    readyState: opts.domLoading === false ? 'complete' : 'loading',
    getElementById(id) {return id === 'creator' && document.readyState !== 'loading' ? form : null;},
    addEventListener(name, callback) {
      assert.strictEqual(name, 'DOMContentLoaded');
      domReadyListeners.push(callback);
    }
  };

  function dispatchSubmit(submitter) {
    if (!nativeValid) return;
    const e = {
      submitter: opts.noSubmitterInEvent ? undefined : submitter,
      defaultPrevented: false,
      preventDefault() {this.defaultPrevented = true;}
    };
    verifyCalls++;
    if (opts.verifyAgree && opts.verifyAgree(verifyCalls) === false) e.preventDefault();
    for (const callback of submitListeners) callback(e);
    submitEvents++;
    if (opts.otherValidator && opts.otherValidator(submitEvents, tokenField.value)) e.preventDefault();
    if (!e.defaultPrevented)
      postRequests.push({token:tokenField.value, submitter:submitter.name});
  }

  vm.runInNewContext(source, {window, document, console:window.console, setTimeout:window.setTimeout});
  function ready() { document.readyState='complete';domReadyListeners.forEach(cb=>cb()); }
  return {
    ready,
    click: () => button.click(),
    pageshow(persisted) {pageShowListeners.forEach(cb=>cb({persisted}));},
    expireTimeouts() {const callbacks=[...timers.values()];timers.clear();callbacks.forEach(cb=>cb());},
    setNativeValid(value) {nativeValid=value;},
    get stats() {return {executeCalls,verifyCalls,submitEvents,postRequests,errorMessages,alertMessages,token:tokenField.value}}
  };
}
const flush = async () => {await Promise.resolve();await new Promise(resolve=>setImmediate(resolve));};

(async()=>{
  let t;
  // The original bug: script executes before the form exists in the parsed HTML.
  t=setup();assert.strictEqual(t.stats.submitEvents,0);t.ready();t.click();await flush();
  assert.strictEqual(t.stats.executeCalls,1);
  assert.strictEqual(t.stats.postRequests.length,1);
  assert.strictEqual(t.stats.postRequests[0].submitter,'regSubmit');
  assert.strictEqual(t.stats.verifyCalls,2);
  assert.ok(t.stats.postRequests[0].token.startsWith('mock-token-'));
  console.log('PASS: DOM readiness, non-empty token, regSubmit and SMF validation');

  t=setup({verifyAgree:()=>false});t.ready();t.click();await flush();
  assert.strictEqual(t.stats.executeCalls,0);
  assert.strictEqual(t.stats.postRequests.length,0);
  console.log('PASS: verifyAgree=false blocks Google and POST');

  t=setup();t.ready();t.click();t.click();await flush();
  assert.strictEqual(t.stats.executeCalls,1);
  assert.strictEqual(t.stats.postRequests.length,1);
  console.log('PASS: double click while CAPTCHA pending');

  t=setup({nativeValid:false});t.ready();t.click();await flush();
  assert.strictEqual(t.stats.executeCalls,0);
  assert.strictEqual(t.stats.postRequests.length,0);
  console.log('PASS: native validation blocks initial submission');

  t=setup({rejectGoogle:true});t.ready();t.click();await flush();
  assert.strictEqual(t.stats.postRequests.length,0);
  assert.strictEqual(t.stats.alertMessages.length,1);
  assert.strictEqual(t.stats.token,'');
  t.click();await flush();assert.strictEqual(t.stats.postRequests.length,1);
  console.log('PASS: Google failure fails closed and allows retry');

  t=setup({googleBlocked:true});t.ready();t.click();await flush();
  assert.strictEqual(t.stats.postRequests.length,0);
  assert.strictEqual(t.stats.alertMessages.length,1);
  console.log('PASS: blocked Google API fails closed');

  t=setup({emptyGoogleToken:true});t.ready();t.click();await flush();
  assert.strictEqual(t.stats.postRequests.length,0);
  assert.strictEqual(t.stats.alertMessages.length,1);
  console.log('PASS: empty Google token fails closed');

  t=setup({verifyAgree:(n)=>n!==2});t.ready();t.click();await flush();
  assert.strictEqual(t.stats.executeCalls,1);
  assert.strictEqual(t.stats.postRequests.length,0);
  assert.strictEqual(t.stats.token,'');
  t.click();await flush();
  assert.strictEqual(t.stats.executeCalls,2);
  assert.strictEqual(t.stats.postRequests.length,1);
  console.log('PASS: second SMF validation can block and reset for retry');

  t=setup({noRequestSubmit:true, noSubmitterInEvent:true});t.ready();t.click();await flush();
  assert.strictEqual(t.stats.postRequests.length,1);
  assert.strictEqual(t.stats.postRequests[0].submitter,'regSubmit');
  console.log('PASS: fallback submit button click preserves regSubmit');

  t=setup({pendingGoogle:true});t.ready();t.click();await flush();
  assert.strictEqual(t.stats.postRequests.length,0);
  t.expireTimeouts();await flush();
  assert.strictEqual(t.stats.alertMessages.length,1);
  assert.strictEqual(t.stats.postRequests.length,0);
  console.log('PASS: Google API timeout fails closed');

  t=setup({otherValidator:(n, token)=>token!==''});t.ready();t.click();await flush();
  assert.strictEqual(t.stats.postRequests.length,0);
  assert.strictEqual(t.stats.token,'');
  t.click();await flush();
  assert.strictEqual(t.stats.executeCalls,2);
  console.log('PASS: other submit validators cancel resubmission and permit retry');

  t=setup({domLoading:false});t.click();await flush();
  assert.strictEqual(t.stats.postRequests.length,1);
  console.log('PASS: immediate initialization when DOM is already ready');

  // Regression: server rejects the original POST (e.g., incorrect SMF visual CAPTCHA),
  // the user returns via Back, and BFCache restores the form and JavaScript state.
  t=setup();t.ready();t.click();await flush();
  assert.strictEqual(t.stats.postRequests.length,1);
  t.pageshow(true);
  assert.strictEqual(t.stats.token,'');
  t.click();await flush();
  assert.strictEqual(t.stats.executeCalls,2);
  assert.strictEqual(t.stats.postRequests.length,2);
  assert.notStrictEqual(t.stats.postRequests[0].token,t.stats.postRequests[1].token);
  console.log('PASS: BFCache return after server-side CAPTCHA error allows a fresh submission');

  t=setup({pendingGoogle:true});t.ready();t.click();await flush();
  t.pageshow(true); // Also reset an unfinished request that was frozen in BFCache.
  t.click();await flush();
  assert.strictEqual(t.stats.executeCalls,2);
  assert.strictEqual(t.stats.postRequests.length,0);
  console.log('PASS: BFCache restore clears an in-flight Google request state');

  t=setup({pendingGoogle:true});t.ready();t.click();await flush();
  t.pageshow(false); // A normal pageshow must NOT reset an active request.
  t.click();await flush();
  assert.strictEqual(t.stats.executeCalls,1);
  console.log('PASS: ordinary pageshow leaves in-flight reCAPTCHA protected');
  console.log('ALL 15 TESTS PASSED');
})().catch(err => {console.error(err.stack);process.exit(1);});
