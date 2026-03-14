package com.configcenter.backend;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
@MapperScan("com.configcenter.backend.module")
public class ConfigCenterBackendApplication {

    public static void main(String[] args) {
        SpringApplication.run(ConfigCenterBackendApplication.class, args);
    }
}
