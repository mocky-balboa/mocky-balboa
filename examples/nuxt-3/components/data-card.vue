<script setup lang="ts">
defineProps<{
    title: string;
    error?: string;
    data?: {
        id: string;
        label: string;
        value: string;
    }[];
}>();
</script>

<template>
    <div
        v-bind:class="{
            'bg-red-300 bg-opacity-30': error,
            'bg-surface-100': !error,
        }"
        class="px-4 py-6 rounded-lg flex-1 flex flex-col"
    >
        <h2
            v-bind:class="error ? 'text-red-500' : ''"
            class="text-xl font-bold mb-4 text-center"
        >
            {{ title }}
        </h2>

        <div
            v-if="error"
            class="text-red-500 font-medium text-center flex-grow justify-center flex flex-col"
        >
            <p class="m-0">
                <em>{{ error }}</em>
            </p>
        </div>

        <div v-else-if="data" class="space-y-2">
            <div
                v-for="item in data"
                :key="item.id"
                class="flex justify-between items-center"
            >
                <span class="font-bold text-md">{{ item.label }}</span>
                <span class="font-medium text-md">{{ item.value }}</span>
            </div>
        </div>
    </div>
</template>
