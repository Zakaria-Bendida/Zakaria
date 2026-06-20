const rooms = {
  managerRoom: () => "managers",

  driverRoom: (ambulanceId) => `driver_${ambulanceId}`,

  allDriversRoom: () => "all_drivers",

  // Get intervention room (for user notifications)
  interventionRoom: (interventionId) => `intervention_${interventionId}`,

  userRoom: (userId) => `user_${userId}`,

  joinUserRooms: (socket, user) => {
    socket.join(rooms.userRoom(user.userId));

    if (user.role === "manager") {
      socket.join(rooms.managerRoom());
    }

    if (user.role === "ambulancier" && user.ambulanceId) {
      socket.join(rooms.driverRoom(user.ambulanceId));
      socket.join(rooms.allDriversRoom());
    }
  },

  leaveUserRooms: (socket, user) => {
    socket.leave(rooms.userRoom(user.userId));

    if (user.role === "manager") {
      socket.leave(rooms.managerRoom());
    }

    if (user.role === "ambulancier" && user.ambulanceId) {
      socket.leave(rooms.driverRoom(user.ambulanceId));
      socket.leave(rooms.allDriversRoom());
    }
  },
};

export default rooms;
