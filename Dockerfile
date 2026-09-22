# Viaja en el Rojo — frontend Angular + API Spring Boot
FROM node:22-bookworm AS frontend
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npx ng build --configuration=production

FROM maven:3.9.9-eclipse-temurin-17 AS build
WORKDIR /build
COPY backend/pom.xml backend/pom.xml
COPY backend/src backend/src
COPY --from=frontend /frontend/dist/frontend/browser frontend/dist/frontend/browser
WORKDIR /build/backend
RUN mvn -q -DskipTests package \
 && cp target/taxi-huamantla-1.0.0.jar /build/app.jar

FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /build/app.jar app.jar
EXPOSE 8084
ENV JAVA_OPTS="-Dfile.encoding=UTF-8"
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
