import User from "../models/User.js";

export const initDriverSocket = (io) => {
  io.on("connection", (socket) => {
    socket.on("driver:online", async (driverId) => {
      try {
        const driver = await User.findById(driverId);
        if (driver && driver.role === "ambulancier") {
          await driver.setOnline(socket.id);

          io.emit("driver:status", {
            driverId: driver._id,
            ambulanceId: driver.ambulanceId,
            status: "online",
            driverName: driver.fullName,
          });

          socket.emit("driver:online:success", {
            message: "You are now online",
          });
        }
      } catch (error) {
        console.error("Driver online error:", error);
      }
    });

    socket.on("driver:offline", async (driverId) => {
      try {
        const driver = await User.findById(driverId);
        if (driver) {
          await driver.setOffline();

          io.emit("driver:status", {
            driverId: driver._id,
            ambulanceId: driver.ambulanceId,
            status: "offline",
            driverName: driver.fullName,
          });
        }
      } catch (error) {
        console.error("Driver offline error:", error);
      }
    });

    // Handle disconnect
    socket.on("disconnect", async () => {
      // Find driver by socketId and mark offline
      const driver = await User.findOne({ socketId: socket.id });
      if (driver) {
        await driver.setOffline();
        io.emit("driver:status", {
          driverId: driver._id,
          ambulanceId: driver.ambulanceId,
          status: "offline",
          driverName: driver.fullName,
        });
      }
    });
  });
};
