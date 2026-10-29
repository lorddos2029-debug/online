<?php
/**
 * Proxy de consulta de CPF.
 *
 * A API data-api.click não devolve o cabeçalho Access-Control-Allow-Origin,
 * por isso o navegador descarta a resposta de uma chamada direta. Aqui a
 * consulta é feita pelo servidor e o JSON volta para a página /cpf.
 */
declare(strict_types=1);

const CPF_API_KEY = 'f8604a38ac827a36576fadcc607344ba';
const CPF_API_URL = 'https://data-api.click/api/cpf.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function responder(int $status, array $corpo): void
{
    http_response_code($status);
    echo json_encode($corpo, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

$cpf = preg_replace('/\D/', '', (string) ($_GET['cpf'] ?? ''));

if (strlen($cpf) !== 11) {
    responder(400, ['sucesso' => false, 'erro' => 'CPF inválido. Informe os 11 dígitos.']);
}

$url = CPF_API_URL . '?cpf=' . $cpf . '&key=' . rawurlencode(CPF_API_KEY);

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_TIMEOUT        => 30,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_HTTPHEADER     => ['Accept: application/json'],
]);

$resposta = curl_exec($ch);
$status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($resposta === false || $status < 200 || $status >= 300) {
    responder(502, ['sucesso' => false, 'erro' => 'Não foi possível consultar agora. Tente novamente.']);
}

$json = json_decode((string) $resposta, true);

if (!is_array($json)) {
    responder(502, ['sucesso' => false, 'erro' => 'Resposta inválida da consulta.']);
}

echo json_encode($json, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
