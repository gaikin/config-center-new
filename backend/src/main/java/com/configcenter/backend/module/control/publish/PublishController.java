package com.configcenter.backend.module.control.publish;

import com.configcenter.backend.common.api.ApiResponse;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/control/publish")
public class PublishController {

    private final PublishService publishService;

    public PublishController(PublishService publishService) {
        this.publishService = publishService;
    }

    @PostMapping("/validate")
    public ApiResponse<Map<String, Object>> validate(@RequestBody Map<String, Object> body) {
        return ApiResponse.success(publishService.validate(body));
    }

    @PostMapping("/tasks")
    public ApiResponse<Map<String, Object>> createTask(@RequestBody Map<String, Object> body) {
        return ApiResponse.success(publishService.createTask(body));
    }

    @GetMapping("/tasks/{taskId}")
    public ApiResponse<Map<String, Object>> getTaskDetail(@PathVariable Long taskId) {
        return ApiResponse.success(publishService.getTaskDetail(taskId));
    }
}
