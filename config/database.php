<?php
/**
 * SynCura — database connection (PDO / MySQL via XAMPP).
 * Matches the schema in database/syncura_auth.sql.
 */

$DB_HOST = '127.0.0.1';
$DB_NAME = 'syncura';
$DB_USER = 'root';
$DB_PASS = '';
$DB_CHARSET = 'utf8mb4';

// One timezone for everything: PHP's date()/strtotime() and MySQL's
// NOW()/CURDATE() must agree on what "today" is, regardless of the server's
// php.ini / OS settings. Bangladesh has no DST, so a fixed +06:00 is exact.
const APP_TIMEZONE = 'Asia/Dhaka';
date_default_timezone_set(APP_TIMEZONE);

function getDb(): PDO {
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }

    global $DB_HOST, $DB_NAME, $DB_USER, $DB_PASS, $DB_CHARSET;
    $dsn = "mysql:host={$DB_HOST};dbname={$DB_NAME};charset={$DB_CHARSET}";

    try {
        $pdo = new PDO($dsn, $DB_USER, $DB_PASS, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
        $pdo->exec("SET time_zone = '" . (new DateTime('now', new DateTimeZone(APP_TIMEZONE)))->format('P') . "'");
    } catch (PDOException $e) {
        http_response_code(500);
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'message' => 'Database connection failed.']);
        exit;
    }

    return $pdo;
}
