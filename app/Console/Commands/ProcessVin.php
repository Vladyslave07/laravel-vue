<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use PhpOffice\PhpSpreadsheet\IOFactory;
use GuzzleHttp\Client;

class ProcessVin extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'process-vin';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Command description';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $webhookUrl = 'https://mihold.online/rest/84733/xij5uzuswm0lp7i0/crm.deal.update';
        $filePath = storage_path("deadline.xlsx");


        // Load the .xls file
        $spreadsheet = IOFactory::load($filePath);
        $sheet = $spreadsheet->getActiveSheet();
        for ($row = 4; $row <= 569; $row++) {
            $rawID = $sheet->getCell('A' . $row)->getValue();
            $rawDate = $sheet->getCell('D' . $row)->getFormattedValue();

            if (empty($rawDate) || empty($rawID)) {
                break;
            }
            $this->info("Обработка строки $row: ID = $rawID, Дата = $rawDate");
            $date = date('Y-m-d\TH:i:s+03:00', strtotime($rawDate));
            $this->update_deal($webhookUrl, $rawID, [
                'UF_CRM_1698069627' => $date
            ]);
        }
    }
    public function update_deal($webhookUrl, $id, $fields)
    {
        $client = new Client(['http_errors' => false]);


        $payload = [
            'ID' => $id,
            'fields' => $fields
        ];
        $response = $client->post($webhookUrl, [
            'headers' => [
                'Content-Type' => 'application/json',
            ],
            'body' => json_encode($payload),
        ]);

        if ($response->getStatusCode() !== 200) {
            $this->error("❌ Не удалось обновить сделку $id: " . $response->getBody());
        } else {
            $this->info("✅ Сделка $id успешно обновлена.");
        }
    }
}
