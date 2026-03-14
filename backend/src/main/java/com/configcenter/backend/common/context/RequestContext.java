package com.configcenter.backend.common.context;

import java.util.List;

public record RequestContext(
        String authorization,
        String traceId,
        String userId,
        String orgId,
        List<String> roleIds
) {
}
