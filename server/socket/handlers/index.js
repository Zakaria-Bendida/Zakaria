// socket/handlers/index.js
import { handleConnection, handleDisconnect } from "./connection.js";
import {
  handleGetNotifications,
  handleMarkNotificationRead,
  handleMarkAllNotificationsRead,
} from "./notification.js";
import { handleLocationUpdate, handleStatusUpdate } from "./ambulance.js";
import {
  handleNewEmergencyCall,
  handleTrackIntervention,
} from "./emergency.js";
import { handleAssignAmbulance, handleCancelAssignment } from "./dispatch.js";

import {
  handleDriverResponse,
  handleDriverStatusUpdate,
  handleDriverLocation,
} from "./driver.js";

export {
  handleConnection,
  handleDisconnect,
  handleGetNotifications,
  handleMarkNotificationRead,
  handleMarkAllNotificationsRead,
  handleLocationUpdate,
  handleStatusUpdate,
  handleNewEmergencyCall,
  handleTrackIntervention,
  handleAssignAmbulance,
  handleCancelAssignment,
  handleDriverResponse,
  handleDriverStatusUpdate,
  handleDriverLocation,
};
