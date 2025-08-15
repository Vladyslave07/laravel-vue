<template>
  <div>
    <div v-if="loading" class="text-center text-xl font-semibold">
      Загрузка Copart...
    </div>
    <iframe
      v-else
      ref="iframeRef"
      :srcdoc="html"
      class="w-full h-[100vh] border rounded"
      frameborder="0"
    ></iframe>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue';
import axios from 'axios';

const currentUrl = ref('https://www.copart.com/');
const html = ref('');
const loading = ref(true);
const iframeRef = ref<HTMLIFrameElement | null>(null);
let ws: WebSocket | null = null;
let lastScrollY = 0; // сохраняем позицию скролла

// ===== Генерация уникального селектора =====
const getUniqueSelector = (el: Element) => {
  if (!el) return '';
  let path = '';
  while (el && el.nodeType === Node.ELEMENT_NODE) {
    let selector = el.nodeName.toLowerCase();
    if ((el as HTMLElement).id) {
      selector += `#${(el as HTMLElement).id}`;
    } else if ((el as HTMLElement).className) {
      selector += `.${Array.from((el as HTMLElement).classList).join('.')}`;
    }
    path = selector + (path ? ' > ' + path : '');
    el = el.parentElement!;
  }
  return path;
};

// ===== Обработчики событий внутри iframe =====
const onIframeClick = (e: MouseEvent) => {
  const target = e.target as HTMLElement;
  if (!target) return;

  const linkEl = target.closest('a[data-href]') as HTMLElement | null;
  if (linkEl) {
    e.preventDefault();
    e.stopPropagation();
    const href = linkEl.getAttribute('data-href');
    if (href) {
      console.log('🔗 Clicked link:', href);
      ws?.send(JSON.stringify({ type: 'navigate', url: href }));
    }
    return;
  }

  if (target.matches('button, input[type="button"], input[type="submit"]')) {
    e.preventDefault();
    e.stopPropagation();
    const selector = getUniqueSelector(target);
    console.log('🖱 Clicked button:', selector);
    ws?.send(JSON.stringify({ type: 'click', selector }));
  }
};

const onIframeSubmit = (e: Event) => {
  e.preventDefault();
  e.stopPropagation();
  const form = e.target as HTMLFormElement;
  const action = form.getAttribute('data-action');
  if (action) {
    console.log('📤 Submit form:', action);
    ws?.send(JSON.stringify({ type: 'navigate', url: action }));
  }
};

const onIframeScroll = () => {
  const iframe = iframeRef.value;
  if (!iframe) return;
  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) return;

  lastScrollY = iframeDoc.documentElement.scrollTop || iframeDoc.body.scrollTop;

  // Отправляем позицию, но не обновляем HTML на сервере
  ws?.send(JSON.stringify({ type: 'scroll', y: lastScrollY }));
};

// ===== Навешиваем события внутри iframe =====
const setupIframeEvents = () => {
  const iframe = iframeRef.value;
  if (!iframe) return;

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) return;

  iframeDoc.removeEventListener('click', onIframeClick, true);
  iframeDoc.removeEventListener('submit', onIframeSubmit, true);
  iframeDoc.removeEventListener('scroll', onIframeScroll);

  iframeDoc.addEventListener('click', onIframeClick, true);
  iframeDoc.addEventListener('submit', onIframeSubmit, true);
  iframeDoc.addEventListener('scroll', onIframeScroll);

  // Восстанавливаем позицию
  iframeDoc.documentElement.scrollTop = lastScrollY;
  iframeDoc.body.scrollTop = lastScrollY;

  console.log('✅ События навешаны, позиция скролла восстановлена');
};

// ===== Инициализация WebSocket =====
const initWebSocket = async () => {
  const response = await axios.get('/proxy-copart');
  ws = new WebSocket(response.data.ws_url);

  ws.onopen = () => console.log('WebSocket подключен');

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === 'html') {
      currentUrl.value = data.url;
      html.value = data.html;
      loading.value = false;

      // После загрузки iframe навешиваем события
      nextTick(() => {
        const iframe = iframeRef.value;
        if (!iframe) return;

        iframe.onload = () => {
          setupIframeEvents();
        };
      });
    }

    // Если сервер прислал только scroll — обновляем lastScrollY, но HTML не трогаем
    if (data.type === 'scroll-pos') {
      lastScrollY = data.y;
    }
  };

  ws.onclose = () => console.log('WebSocket отключен');
};

// ===== Монтирование =====
onMounted(() => {
  initWebSocket();
});
</script>
