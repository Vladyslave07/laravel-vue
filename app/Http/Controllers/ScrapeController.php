<?php

namespace App\Http\Controllers;

use Symfony\Component\Process\Process;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use GuzzleHttp\Client;

class ScrapeController extends Controller
{
    private $cookiesPath;

    public function __construct()
    {
        $this->cookiesPath = base_path('copart-cookies.json');
    }
    public function fetchIAAI(Request $request)
    {
        $url = $request->input('url', 'https://www.iaai.com/');
        ini_set('max_execution_time', 0);
        $nodePath = 'C:\\Program Files\\nodejs\\node.exe';
        $scriptPath = base_path('scrape-iaai.js');

        // Переменные окружения
        $env = [
            'TEMP' => sys_get_temp_dir(),
            'TMP'  => sys_get_temp_dir(),
            'PATH' => getenv('PATH'),
        ];

        // Создаём процесс
        $process = new Process([$nodePath, $scriptPath, $url], null, $env);
        $process->setTimeout(180);
        $process->run();
        if (!$process->isSuccessful()) {
            dd($process, 'Scraping failed: ' . $process->getErrorOutput());
            return response()->json(['error' => 'Scraping failed'], 500);
        }
        $lines = explode("\n", trim($process->getOutput()));
        $lastLine = trim(end($lines));
        $output = json_decode($lastLine, true);

        if (!$output || !isset($output['html'])) {
            return response('<p>Empty content</p>', 200)->header('Content-Type', 'text/html');
        }

        return response($output['html'], 200)->header('Content-Type', 'text/html');
    }

    public function fetchCopart(Request $request)
    {
        $url = $request->input('url', 'https://www.copart.com/');
        ini_set('max_execution_time', 0);
        $nodePath = 'C:\\Program Files\\nodejs\\node.exe';
        $scriptPath = base_path('scrape-copart.js');

        // Переменные окружения
        $env = [
            'TEMP' => sys_get_temp_dir(),
            'TMP'  => sys_get_temp_dir(),
            'PATH' => getenv('PATH'),
        ];


        // Создаём процесс
        $process = new Process([$nodePath, $scriptPath, $url], null, $env);
        $process->setTimeout(180);
        $process->run();
        if (!$process->isSuccessful()) {
            return response()->json(['error' => 'Scraping failed'], 500);
        }
        $lines = explode("\n", trim($process->getOutput()));
        $lastLine = trim(end($lines));
        $output = json_decode($lastLine, true);

        if (!$output || !isset($output['html'])) {
            return response('<p>Empty content</p>', 200)->header('Content-Type', 'text/html');
        }

        return response($output['html'], 200)->header('Content-Type', 'text/html');
    }
    public function proxyCopart(Request $request)
    {
        $url = $request->input('url', 'https://www.copart.com/');
        $nodePath = 'C:\\Program Files\\nodejs\\node.exe'; 
        $scriptPath = base_path('server.js');

        $env = [
            'TEMP' => sys_get_temp_dir(),
            'TMP'  => sys_get_temp_dir(),
            'PATH' => getenv('PATH'),
        ];

   
        $process = new Process([$nodePath, $scriptPath, $url], null, $env);
        $process->setTimeout(0);
        $process->start();
        
        // Отдаём клиенту WebSocket URL
        return response()->json([
            'ws_url' => 'ws://localhost:8080',
        ]);
    }
}
