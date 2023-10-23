# Use an official Nginx runtime as a parent image
FROM nginx:1.21.1-alpine

# Copy the build files to the container
COPY dist /usr/share/nginx/html

# Copy the Nginx configuration file to the container
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80 for the application
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
