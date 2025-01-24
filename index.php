<?php
require_once __DIR__ . '/controllers/TextController.php';
require_once __DIR__ . '/config/routes.php';

function handler($event, $context) {
    $logger = $GLOBALS['fcLogger'];
    $logger->info('receive event: ' . $event);
    
    try {
        $evt = json_decode($event, true);
        if (is_null($evt['body'])) {
            throw new Exception("请求体为空");
        }

        $path = $evt['path'] ?? '';
        $method = $evt['httpMethod'] ?? '';
        $body = $evt['body'];
        if ($evt['isBase64Encoded']) {
            $body = base64_decode($evt['body']);
        }

        // 获取路由配置
        $routes = require __DIR__ . '/config/routes.php';
        
        if (!isset($routes[$path])) {
            throw new Exception("未知的路由路径");
        }
        
        $route = $routes[$path];
        if ($method !== $route['method']) {
            throw new Exception("方法不允许，请使用{$route['method']}");
        }

        // 实例化控制器并执行操作
        $controllerName = $route['controller'];
        $actionName = $route['action'];
        
        $controller = new $controllerName($context);
        return $controller->$actionName($body);
        
    } catch (Exception $e) {
        $logger->error("错误: " . $e->getMessage());
        return array(
            "statusCode" => 400,
            'headers' => array("Content-Type" => "application/json"),
            'isBase64Encoded' => false,
            "body" => json_encode(array("error" => $e->getMessage()))
        );
    }
}