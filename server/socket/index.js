// server/socket/index.js - UPDATED with roadblock events

import { Server } from "socket.io";
import User from "../models/User.js";

const initializeSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: [
        "http://192.168.1.5:5173",
        "http://192.168.1.5:8081",
        "http://192.168.1.5:8081",
        "exp://192.168.1.5:8081",
      ],
      credentials: true,
    },
  });

  // Store online managers for targeted notifications
  const onlineManagers = new Set();

  io.on("connection", (socket) => {
    // ✅ Driver goes online
    socket.on("driver:online", async (data) => {
      try {
        const { driverId, ambulanceId } = data;

        const currentDriver = await User.findById(driverId);
        if (!currentDriver) {
          socket.emit("driver:online:error", { error: "Driver not found" });
          return;
        }

        const otherOnlineDrivers = await User.find({
          _id: { $ne: driverId },
          ambulanceId: ambulanceId,
          role: "ambulancier",
          isOnline: true,
        });

        // Logout other drivers
        for (const driver of otherOnlineDrivers) {
          await User.findByIdAndUpdate(driver._id, {
            isOnline: false,
            socketId: null,
          });

          if (driver.socketId) {
            io.to(driver.socketId).emit("driver:logged-out", {
              message: "Un autre chauffeur s'est connecté sur votre ambulance",
              ambulanceId: ambulanceId,
            });
          }
        }

        // Set current driver online
        const updatedDriver = await User.findByIdAndUpdate(
          driverId,
          {
            isOnline: true,
            socketId: socket.id,
            lastOnline: new Date(),
          },
          { new: true },
        );

        // Join ambulance room
        const roomName = `driver_${ambulanceId}`;
        socket.join(roomName);

        // Notify all clients about status change
        io.emit("driver:status", {
          driverId,
          driverName: updatedDriver.fullName,
          ambulanceId,
          status: "online",
          timestamp: new Date(),
        });

        // Confirm to driver
        socket.emit("driver:online:confirmed", {
          success: true,
          message: "Vous êtes maintenant en ligne",
          data: {
            driverId: updatedDriver._id,
            fullName: updatedDriver.fullName,
            ambulanceId: updatedDriver.ambulanceId,
            isOnline: true,
          },
        });
      } catch (error) {
        console.error("Driver online error:", error);
        socket.emit("driver:online:error", { error: error.message });
      }
    });

    // ✅ Manager goes online
    socket.on("manager:online", async (data) => {
      try {
        const { managerId, managerName } = data;
        onlineManagers.add(socket.id);
        socket.join("managers");
        console.log(`👔 Manager ${managerName} is now online`);
        socket.emit("manager:online:confirmed", { success: true });
      } catch (error) {
        console.error("Manager online error:", error);
      }
    });

    // ✅ Manager goes offline
    socket.on("manager:offline", () => {
      onlineManagers.delete(socket.id);
      socket.leave("managers");
      console.log("👔 Manager went offline");
    });

    // ✅ Driver reports roadblock (with manager notification)
    socket.on("driver:roadblock", async (data) => {
      try {
        const { driverId, edge_id, reason, estimated_duration, roadblockId } =
          data;

        console.log(
          `🚧 Roadblock reported by driver ${driverId} on edge ${edge_id}`,
        );

        // Get driver info for notification
        const driver = await User.findById(driverId);

        // Notify all managers about pending roadblock
        io.to("managers").emit("roadblock_pending", {
          id: roadblockId,
          edge_id,
          reason: reason || "Accident",
          estimated_duration: estimated_duration || 30,
          reported_by: {
            id: driverId,
            driver_name: driver?.fullName || "Unknown",
            ambulance: driver?.ambulanceId,
          },
          timestamp: new Date(),
        });

        // Confirm to driver that report was sent
        socket.emit("driver:roadblock:confirmed", {
          success: true,
          message: "Roadblock reported. Waiting for manager approval.",
        });
      } catch (error) {
        console.error("Roadblock report error:", error);
        socket.emit("driver:roadblock:error", { error: error.message });
      }
    });

    // ✅ Manager approves roadblock
    socket.on("manager:approve_roadblock", async (data) => {
      try {
        const {
          roadblockId,
          edge_id,
          reason,
          estimated_duration,
          reported_by,
          managerName,
        } = data;

        console.log(
          `✅ Manager ${managerName} approved roadblock ${roadblockId}`,
        );

        // Notify the reporting driver
        io.to(`driver_${reported_by}`).emit("roadblock_approved", {
          edge_id,
          reason,
          estimated_duration,
          message: "Your roadblock report has been approved.",
          timestamp: new Date(),
        });

        // Notify all drivers about new active roadblock
        io.emit("roadblock_active", {
          edge_id,
          reason,
          estimated_duration,
          approved_by: managerName,
          timestamp: new Date(),
        });

        // Confirm to manager
        socket.emit("manager:approve:confirmed", {
          success: true,
          message: "Roadblock approved and activated",
        });
      } catch (error) {
        console.error("Approve roadblock error:", error);
        socket.emit("manager:approve:error", { error: error.message });
      }
    });

    // ✅ Manager rejects roadblock
    socket.on("manager:reject_roadblock", async (data) => {
      try {
        const {
          roadblockId,
          edge_id,
          reported_by,
          rejection_reason,
          managerName,
        } = data;

        console.log(
          `❌ Manager ${managerName} rejected roadblock ${roadblockId}`,
        );

        // Notify the reporting driver
        io.to(`driver_${reported_by}`).emit("roadblock_rejected", {
          edge_id,
          reason: rejection_reason,
          message: "Your roadblock report has been rejected.",
          timestamp: new Date(),
        });

        // Confirm to manager
        socket.emit("manager:reject:confirmed", {
          success: true,
          message: "Roadblock rejected",
        });
      } catch (error) {
        console.error("Reject roadblock error:", error);
        socket.emit("manager:reject:error", { error: error.message });
      }
    });

    // ✅ Manager clears roadblock
    socket.on("manager:clear_roadblock", async (data) => {
      try {
        const { edge_id, managerName } = data;

        console.log(
          `✅ Manager ${managerName} cleared roadblock on edge ${edge_id}`,
        );

        // Notify all drivers that roadblock is cleared
        io.emit("roadblock_cleared", {
          edge_id,
          cleared_by: managerName,
          timestamp: new Date(),
          message: "Roadblock cleared. Routes have been updated.",
        });

        // Confirm to manager
        socket.emit("manager:clear:confirmed", {
          success: true,
          message: "Roadblock cleared successfully",
        });
      } catch (error) {
        console.error("Clear roadblock error:", error);
        socket.emit("manager:clear:error", { error: error.message });
      }
    });

    // ✅ Notify driver of mission cancellation
    socket.on("notify_driver_cancellation", (data) => {
      const { ambulanceId, interventionId } = data;
      io.to(`driver_${ambulanceId}`).emit("mission_cancelled", {
        interventionId,
        message: "La mission a été annulée par le dispatcher.",
      });
    });

    // ✅ Driver goes offline
    socket.on("driver:offline", async (data) => {
      try {
        const { driverId, ambulanceId } = data;

        const roomName = `driver_${ambulanceId}`;
        socket.leave(roomName);

        const updatedDriver = await User.findByIdAndUpdate(
          driverId,
          { isOnline: false, socketId: null },
          { new: true },
        );

        if (updatedDriver) {
          console.log(`⚫ Driver ${updatedDriver.fullName} is now OFFLINE`);

          io.emit("driver:status", {
            driverId,
            driverName: updatedDriver.fullName,
            ambulanceId,
            status: "offline",
            timestamp: new Date(),
          });

          socket.emit("driver:offline:confirmed", {
            success: true,
            message: "Vous êtes maintenant hors ligne",
          });
        }
      } catch (error) {
        console.error("Driver offline error:", error);
        socket.emit("driver:offline:error", { error: error.message });
      }
    });

    // ✅ Update driver location (real-time tracking)
    socket.on("driver:location", async (data) => {
      try {
        const { driverId, latitude, longitude } = data;

        await User.findByIdAndUpdate(driverId, {
          currentLatitude: latitude,
          currentLongitude: longitude,
          lastLocationUpdate: new Date(),
        });

        const driver = await User.findById(driverId);
        if (driver && driver.ambulanceId) {
          io.emit(`ambulance:location:${driver.ambulanceId}`, {
            ambulanceId: driver.ambulanceId,
            driverName: driver.fullName,
            latitude,
            longitude,
            timestamp: new Date(),
          });
        }
      } catch (error) {
        console.error("Location update error:", error);
      }
    });

    // ✅ Driver starts intervention
    socket.on("driver:start-mission", async (data) => {
      try {
        const { driverId, interventionId } = data;

        await User.findByIdAndUpdate(driverId, {
          currentInterventionId: interventionId,
        });

        const driver = await User.findById(driverId);
        console.log(
          `🚑 Driver ${driver?.fullName} started mission ${interventionId}`,
        );

        io.emit("mission:started", {
          driverId,
          driverName: driver?.fullName,
          interventionId,
          timestamp: new Date(),
        });

        socket.emit("mission:started:confirmed", { success: true });
      } catch (error) {
        console.error("Start mission error:", error);
      }
    });

    // ✅ Driver completes intervention
    socket.on("driver:complete-mission", async (data) => {
      try {
        const { driverId, interventionId } = data;

        await User.findByIdAndUpdate(driverId, {
          currentInterventionId: null,
        });

        const driver = await User.findById(driverId);
        console.log(
          `✅ Driver ${driver?.fullName} completed mission ${interventionId}`,
        );

        io.emit("mission:completed", {
          driverId,
          driverName: driver?.fullName,
          interventionId,
          timestamp: new Date(),
        });

        socket.emit("mission:completed:confirmed", { success: true });
      } catch (error) {
        console.error("Complete mission error:", error);
      }
    });

    // ✅ Get online drivers (for admin panel)
    socket.on("admin:get-online-drivers", async () => {
      try {
        const onlineDrivers = await User.find({
          role: "ambulancier",
          isOnline: true,
          isActive: true,
        }).select("-passwordHash");

        socket.emit("admin:online-drivers", {
          count: onlineDrivers.length,
          drivers: onlineDrivers,
        });
      } catch (error) {
        console.error("Get online drivers error:", error);
      }
    });

    // ✅ Handle disconnect
    socket.on("disconnect", async () => {
      console.log("🔴 Client disconnected:", socket.id);

      // Remove from managers set if manager
      if (onlineManagers.has(socket.id)) {
        onlineManagers.delete(socket.id);
      }

      try {
        const driver = await User.findOne({ socketId: socket.id });
        if (driver) {
          await User.findByIdAndUpdate(driver._id, {
            isOnline: false,
            socketId: null,
          });

          console.log(
            `⚫ Auto-disconnect: Driver ${driver.fullName} marked offline`,
          );

          io.emit("driver:status", {
            driverId: driver._id,
            driverName: driver.fullName,
            ambulanceId: driver.ambulanceId,
            status: "offline",
            timestamp: new Date(),
          });
        }
      } catch (error) {
        console.error("Disconnect cleanup error:", error);
      }
    });
  });

  return io;
};

export default initializeSocket;
