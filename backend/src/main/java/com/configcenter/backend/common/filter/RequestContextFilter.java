package com.configcenter.backend.common.filter;

import com.configcenter.backend.common.context.RequestContext;
import com.configcenter.backend.common.context.RequestContextHolder;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component("traceContextFilter")
public class RequestContextFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        String traceId = readHeader(request, "X-Trace-Id", "trace-" + UUID.randomUUID());
        String userId = readHeader(request, "X-User-Id", "system.demo");
        String orgId = readHeader(request, "X-Org-Id", "org.demo");
        List<String> roleIds = Arrays.stream(readHeader(request, "X-Role-Ids", "business-config").split(","))
                .map(String::trim)
                .filter(item -> !item.isEmpty())
                .collect(Collectors.toList());

        RequestContextHolder.set(new RequestContext(
                request.getHeader("Authorization"),
                traceId,
                userId,
                orgId,
                roleIds
        ));
        response.setHeader("X-Trace-Id", traceId);

        try {
            filterChain.doFilter(request, response);
        } finally {
            RequestContextHolder.clear();
        }
    }

    private String readHeader(HttpServletRequest request, String name, String defaultValue) {
        String value = request.getHeader(name);
        return value == null || value.isBlank() ? defaultValue : value;
    }
}
