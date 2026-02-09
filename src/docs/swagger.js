
import swaggerJSDoc from "swagger-jsdoc";
const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Sewer Projects Management API",
      version: "1.0.0",
      description: "System for managing sewer infrastructure projects"
    },
    servers: [
      {
        url: "http://localhost:3000/api",
        description: "Local server"
      },
      {
        url: "https://zmsco.onrender.com/api",
        description: "Production server"
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT"
        }
      }
    },
    security: [{ bearerAuth: [] }]
  },

  apis: ["./src/modules/**/*.js"]
};

export default swaggerJSDoc(options);

