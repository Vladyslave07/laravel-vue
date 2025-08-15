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
import { ref, onMounted, watch } from 'vue'
import axios from 'axios'

const html = ref('')
const loading = ref(true)
const iframeRef = ref<HTMLIFrameElement | null>(null)
const currentUrl = ref('https://www.iaai.com/')

const loadIAAIPage = async (url: string) => {
  loading.value = true
  try {
    const response = await axios.get('/iaai-html', {
      params: { url }
    })
    html.value = response.data
    currentUrl.value = url
  } catch (e) {
    html.value = '<p class="text-red-500">Ошибка загрузки страницы</p>'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadIAAIPage(currentUrl.value)

  window.addEventListener('message', (event) => {
    if (event.data?.iaaiNavigate) {
      const url = event.data.iaaiNavigate
      loadIAAIPage(url)
    }
  })
})

watch(html, () => {
  setTimeout(() => {
    const iframe = iframeRef.value
    if (!iframe) return

    const iframeDoc = iframe.contentDocument
    if (!iframeDoc) return

    iframeDoc.querySelectorAll('a').forEach((a) => {
      a.addEventListener('click', (e) => {
        e.preventDefault()
        const target = e.currentTarget as HTMLAnchorElement
        const href = target.getAttribute('href')
        if (href && href.startsWith('/')) {
          const fullUrl = new URL(href, currentUrl.value).toString()
          loadIAAIPage(fullUrl)
        } else if (href?.startsWith('http') && href.includes('iaai.com')) {
          loadIAAIPage(href)
        }
      })
    })
  }, 100) 
})
</script>