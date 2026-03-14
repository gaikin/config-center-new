package com.configcenter.backend.common.api;

import java.util.List;

public record PageResponse<T>(long total, long pageNo, long pageSize, List<T> records) {
}
