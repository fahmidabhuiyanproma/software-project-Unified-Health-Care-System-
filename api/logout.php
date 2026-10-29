<?php
/**
 * POST /api/logout.php — clears the server-side session.
 */

require_once __DIR__ . '/_bootstrap.php';

$_SESSION = [];
session_destroy();

respond(['success' => true]);
