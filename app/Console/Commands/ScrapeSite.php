<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Symfony\Component\Process\Process;

class ScrapeSite extends Command
{
    protected $signature = 'scrape:site';
    protected $description = 'Scrape example website';

    public function handle()
    {
        $url = 'https://www.copart.com/';
        $this->info("Scraping URL: $url");

        $process = new Process(['node', 'scraper/scrape-iaaitest.js', $url]);
        $process->setTimeout(60);
        $process->run();

        if (!$process->isSuccessful()) {
            $this->error('Scraping failed: ' . $process->getErrorOutput());
            return 1;
        }

        $output = json_decode($process->getOutput(), true);
        $title = $output['title'] ?? 'N/A';
        $html = $output['html'] ?? 'N/A';
        $this->info("Page Title: $title");
        $this->info("Page HTML: " . substr($html, 0, 200) . '...');
        return 0;
    }
}
