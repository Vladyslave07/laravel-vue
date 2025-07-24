<script setup lang="ts">
import AppLayout from '@/layouts/AppLayout.vue';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/vue3';
import PlaceholderICopart from '@/components/PlaceholderCopart.vue';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Copart',
        href: '/copart',
    },
];
</script>

<template>
    <Head title="Copart" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="flex h-full flex-1 flex-col gap-4 rounded-xl p-4 overflow-x-auto">
            <div class="relative min-h-[100vh] flex-1 rounded-xl border border-sidebar-border/70 md:min-h-min dark:border-sidebar-border">
                <PlaceholderICopart />
            </div>
        </div>
    </AppLayout>
</template>
