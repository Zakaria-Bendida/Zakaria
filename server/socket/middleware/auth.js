import jwt from "jsonwebtoken";

const getJWTSecret = () => {
  return process.env.JWT_SECRET || "secret123";
};

const socketAuth = async (socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.split(" ")[1];

    if (!token) {
      console.log("❌ Socket auth: No token provided");
      return next(new Error("Authentication error: No token provided"));
    }

    const decoded = jwt.verify(token, getJWTSecret());
    socket.user = decoded;
    console.log(
      `✅ Socket auth success: ${decoded.fullName} (${decoded.role})`,
    );
    next();
  } catch (error) {
    console.log("❌ Socket auth error:", error.message);
    next(new Error("Authentication error: Invalid token"));
  }
};

export { socketAuth };
