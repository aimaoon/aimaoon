/*
 * Stage Note の Service Worker。
 * アプリを閉じていてもプッシュを受け取って通知を出すためだけに置いている。
 * 画面のキャッシュ（オフライン対応）はまだしていない。
 */

self.addEventListener('install', () => {
  // 新しい内容をすぐ有効にする。
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: 'Stage Note', body: event.data ? event.data.text() : '' }
  }

  const title = data.title || 'Stage Note'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      // 同じ予定が二重に鳴らないように、サーバー側の ID をそのまま使う。
      tag: data.tag || title,
      icon: '/icon.svg',
      badge: '/icon.svg',
      data: { url: data.url || '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      // すでに開いていればそれを前に出す。無ければ開く。
      for (const client of windows) {
        if ('focus' in client) return client.focus()
      }
      return self.clients.openWindow(target)
    }),
  )
})
