// Function to do some input disabling depending on if reCAPTCHA checkbox is active.
function checkRecaptcha()
{
	const recaptchaEnabled = document.getElementById('recaptchaEnabled_input').checked;
	document.getElementById('recaptchaSiteKey_input').disabled = !recaptchaEnabled;
	document.getElementById('recaptchaSecretKey_input').disabled = !recaptchaEnabled;
	document.getElementById('recaptchaMinScore_input').disabled = !recaptchaEnabled;
	document.getElementById('recaptchaMinScore_output').disabled = !recaptchaEnabled;
}

// Put stuff in order before submitting the form
document.querySelector('form[action*="action=regcenter"]').addEventListener('submit', function(event) {
	let recaptchaInputs = this.querySelectorAll(
		"input#recaptchaSiteKey_input, input#recaptchaSecretKey_input, input#recaptchaMinScore_input, input#recaptchaMinScore_output"
	);

	recaptchaInputs.forEach(function(input) {
		// We want to keep the keys, even if the user disabled reCAPTCHA
        if (input.disabled) {
            input.removeAttribute('disabled');
        }

		// Avoid submitting junk (reCaptchaSecretKeyPlaceholder is set inside Register.template.php)
        if (input.id === 'recaptchaSecretKey_input' && input.value === reCaptchaSecretKeyPlaceholder) {
            input.disabled = true;
        }
    });
});
