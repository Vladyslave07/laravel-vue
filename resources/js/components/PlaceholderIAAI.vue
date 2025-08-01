<template>
    <div v-if="loading" class="text-center text-xl font-semibold">Загрузка IAAI...</div>
   <iframe
    v-else
    :srcdoc="html"
    class="w-full h-[100vh] border rounded"
    frameborder="0"
  ></iframe>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import axios from 'axios'

const html = ref('')
const loading = ref(true)

onMounted(async () => {
  try {
    const response = await axios.get('/iaai-html')
    html.value = response.data
  } catch (e) {
    html.value = '<p class="text-red-500">Ошибка загрузки данных с сервера</p>'
  } finally {
    loading.value = false
  }
})
</script>