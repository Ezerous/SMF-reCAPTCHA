<?php

function fail_test($message)
{
	fwrite(STDERR, 'FAIL: ' . $message . PHP_EOL);
	exit(1);
}

function apply_replacement($source, $search, $replacement)
{
	$count = 0;
	$result = str_replace($search, $replacement, $source, $count);

	if ($count !== 1)
		fail_test('expected exactly one replacement, found ' . $count);

	return $result;
}

$namespace = 'http://www.simplemachines.org/xml/modification';
$document = new DOMDocument();

if (!$document->load(dirname(dirname(__FILE__)) . DIRECTORY_SEPARATOR . 'modification.xml'))
	fail_test('could not load modification.xml');

$file_nodes = $document->getElementsByTagNameNS($namespace, 'file');
if ($file_nodes->length === 0)
	fail_test('expected at least one modified file');

$operations = $document->getElementsByTagNameNS($namespace, 'operation');
if ($operations->length === 0)
	fail_test('expected at least one modification operation');

for ($i = 0; $i < $operations->length; $i++)
{
	$operation = $operations->item($i);
	$search_nodes = $operation->getElementsByTagNameNS($namespace, 'search');
	$add_nodes = $operation->getElementsByTagNameNS($namespace, 'add');

	if ($search_nodes->length !== 1 || $add_nodes->length !== 1)
		fail_test('each operation must contain one search and one add element');

	$position = $search_nodes->item(0)->getAttribute('position');

	$search = $search_nodes->item(0)->textContent;
	$add = $add_nodes->item(0)->textContent;

	if ($search === '')
		fail_test('search element cannot be empty');

	if (preg_match('/[=,]\s*\[/', $add))
		fail_test('replacement contains PHP short array syntax');

	$original = "prefix\n" . $search . "\nsuffix";

	switch ($position)
	{
		case 'replace':
			$installed = apply_replacement($original, $search, $add);
			$restored = apply_replacement($installed, $add, $search);
			break;

		case 'before':
			$installed = apply_replacement($original, $search, $add . $search);
			$restored = apply_replacement($installed, $add . $search, $search);
			break;

		case 'after':
			$installed = apply_replacement($original, $search, $search . $add);
			$restored = apply_replacement($installed, $search . $add, $search);
			break;

		default:
			fail_test('unsupported operation position: ' . $position);
	}

	if ($restored !== $original)
		fail_test('operation ' . ($i + 1) . ' is not reversible');
}

$package_document = new DOMDocument();
if (!$package_document->load(dirname(dirname(__FILE__)) . DIRECTORY_SEPARATOR . 'package-info.xml'))
	fail_test('could not load package-info.xml');

$package_versions = $package_document->getElementsByTagName('version');
$modification_versions = $document->getElementsByTagNameNS($namespace, 'version');

if ($package_versions->length !== 1 || $modification_versions->length !== 1)
	fail_test('expected one package version in each XML file');

if ($package_versions->item(0)->textContent !== $modification_versions->item(0)->textContent)
	fail_test('package and modification versions do not match');

echo 'PASS: XML, PHP compatibility, version consistency, and replacement reversibility' . PHP_EOL;

?>
