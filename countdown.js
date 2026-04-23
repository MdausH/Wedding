(function () {
  const weddingDate = new Date("2026-06-20T11:30:00+08:00");

  const updateCountdown = () => {
    const days = document.querySelector("#countdown-days");
    const hours = document.querySelector("#countdown-hours");
    const minutes = document.querySelector("#countdown-minutes");
    const seconds = document.querySelector("#countdown-seconds");
    const message = document.querySelector("#countdown-message");

    if (!days || !hours || !minutes || !seconds || !message) {
      return;
    }

    const now = new Date();
    const difference = weddingDate.getTime() - now.getTime();

    if (difference <= 0) {
      days.textContent = "0";
      hours.textContent = "0";
      minutes.textContent = "0";
      seconds.textContent = "0";
      message.textContent = "Today is the day. We cannot wait to celebrate with you.";
      return;
    }

    const totalSeconds = Math.floor(difference / 1000);
    const dayValue = Math.floor(totalSeconds / 86400);
    const hourValue = Math.floor((totalSeconds % 86400) / 3600);
    const minuteValue = Math.floor((totalSeconds % 3600) / 60);
    const secondValue = totalSeconds % 60;

    days.textContent = String(dayValue);
    hours.textContent = String(hourValue);
    minutes.textContent = String(minuteValue);
    seconds.textContent = String(secondValue);
    message.textContent = "We cannot wait to celebrate with you.";
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", updateCountdown, { once: true });
  } else {
    updateCountdown();
  }

  setInterval(updateCountdown, 1000);
})();
