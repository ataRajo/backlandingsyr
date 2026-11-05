import { io } from "socket.io-client";

const socket = io("http://localhost:3000");

socket.on("connect", () => {
    console.log("Connected:", socket.id);

    socket.emit("conversations:list", {
        page: 1,
        limit: 20
    });
});

socket.on("conversations:list", (data) => {
    console.log("Response:", data);
});
