<?php
// Deletes settings, given an array of their keys (see also updateSettings in Subs.php).
function deleteSettings($keysArray)
{
	global $db_prefix, $modSettings;

	if (empty($keysArray) || !is_array($keysArray))
		return;

	// Prepare the list of keys to delete
	$deleteArray = array();
	foreach ($keysArray as $variable)
	{
		if (isset($modSettings[$variable]))
		{
			$deleteArray[] = "'" . addslashes($variable) . "'";
			unset($modSettings[$variable]);
		}
	}

	if (empty($deleteArray))
		return;

	db_query("
		DELETE FROM {$db_prefix}settings
		WHERE variable IN (" . implode(', ', $deleteArray) . ")
	", __FILE__, __LINE__);

	cache_put_data('modSettings', null, 90);
}

deleteSettings(array('recaptchaEnabled', 'recaptchaSiteKey', 'recaptchaSecretKey', 'recaptchaMinScore'));

?>
