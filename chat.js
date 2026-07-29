function sendMessage() {
    const input = document.getElementById("messageInput");
    const messages = document.getElementById("messages");

    if (input.value.trim() === "") return;

    const message = document.createElement("div");
    message.className = "message sent";
    message.textContent = input.value;

    messages.appendChild(message);

    input.value = "";

    messages.scrollTop = messages.scrollHeight;
}