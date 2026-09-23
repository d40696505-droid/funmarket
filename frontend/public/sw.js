// Service worker для Web Push. Не кеширует страницы (не PWA-офлайн-режим) —
// единственная задача: показывать push-уведомления и открывать/фокусировать
// вкладку сайта по клику на них.

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }
  const { title, body, data } = payload;
  event.waitUntil(
    self.registration.showNotification(title || "HobbyHub", {
      body: body || "",
      icon: "/favicon.ico",
      data: data || {},
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const chatId = event.notification.data?.chatId;
  const url = chatId ? `/chats/${chatId}` : "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if ("focus" in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        return self.clients.openWindow(url);
      }),
  );
});
