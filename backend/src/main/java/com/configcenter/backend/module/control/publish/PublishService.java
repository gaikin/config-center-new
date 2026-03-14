package com.configcenter.backend.module.control.publish;

import com.configcenter.backend.common.support.DemoDataFactory;
import java.util.Map;
import org.springframework.stereotype.Service;

@Service
public class PublishService {

    private final PublishTaskMapper publishTaskMapper;

    public PublishService(PublishTaskMapper publishTaskMapper) {
        this.publishTaskMapper = publishTaskMapper;
    }

    public Map<String, Object> validate(Map<String, Object> body) {
        return DemoDataFactory.publishValidation(body);
    }

    public Map<String, Object> createTask(Map<String, Object> body) {
        return DemoDataFactory.publishTask(body);
    }

    public Map<String, Object> getTaskDetail(Long taskId) {
        return DemoDataFactory.publishTaskDetail(taskId);
    }
}
