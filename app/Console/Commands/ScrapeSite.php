<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use GuzzleHttp\Client;
use Symfony\Component\DomCrawler\Crawler;

class ScrapeSite extends Command
{
    protected $signature = 'scrape:site';
    protected $description = 'Scrape example website';

    public function handle()
    {
        $url = 'https://www.iaai.com';

        $client = new Client([
            'verify' => false,
        ]);

        $response = $client->request('GET', $url);
        $html = $response->getBody()->getContents();

        $crawler = new Crawler($html);
        $this->info('Scraping started...');
        $header = $crawler->text();
        $this->info("Page header: $header");
        $this->info('Scraping finished!');
    }
}
