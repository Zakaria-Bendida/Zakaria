import rooms from "../rooms.js";

export function handleConnection(socket, io) {
  const user = socket.user;

  rooms.joinUserRooms(socket, user);

  // Send welcome message
  socket.emit("welcome", {
    message: `Welcome ${user.fullName}! You are connected as ${user.role}`,
    role: user.role,
    socketId: socket.id,
    timestamp: new Date(),
  });

  // Broadcast to managers that a driver connected
  if (user.role === "ambulancier") {
    io.to(rooms.managerRoom()).emit("driver_connected", {
      driverId: user.userId,
      driverName: user.fullName,
      ambulanceId: user.ambulanceId,
      timestamp: new Date(),
    });
  }

  if (user.currentInterventionId) {
    socket.join(rooms.interventionRoom(user.currentInterventionId));
  }
}

export function handleDisconnect(socket, io) {
  const user = socket.user;
  if (user) {
    console.log(
      `🔌 User disconnected: ${user.fullName} (${user.role}) - Socket ID: ${socket.id}`,
    );
    rooms.leaveUserRooms(socket, user);

    if (user.role === "ambulancier") {
      io.to(rooms.managerRoom()).emit("driver_disconnected", {
        driverId: user.userId,
        driverName: user.fullName,
        ambulanceId: user.ambulanceId,
        timestamp: new Date(),
      });
    }
  }
}
