# Config Center Backend

Spring Boot + MyBatis backend scaffold for the config center project.

## Stack

- Java 17
- Spring Boot
- MyBatis
- H2 (default local simulation)
- MySQL
- Maven

## Scripts

- `mvn -f backend/pom.xml spring-boot:run`
- `mvn -f backend/pom.xml -DskipTests package`

## Profiles

- Default profile: `h2`
- Switch to MySQL: `SPRING_PROFILES_ACTIVE=mysql`

## H2 Console

- URL: `http://localhost:8080/h2-console`
- JDBC URL: `jdbc:h2:mem:config_center`
- User: `sa`
- Password: empty

## Structure

- `src/main/java`: application source
- `src/main/resources`: Spring and MyBatis resources
- `db/migrations`: draft MySQL schema scripts

## Notes

- The project follows a three-layer architecture: `controller -> service -> mapper`.
- Current endpoints provide scaffold-grade demo responses to unblock frontend integration and API wiring.
- Local startup works out of the box with in-memory H2.
