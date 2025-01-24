<?php
class BaseController {
    protected $logger;
    protected $ossClient;
    protected $bucket;
    
    public function __construct($context) {
        $this->logger = $GLOBALS['fcLogger'];
        $this->ossClient = $context->getCredentials()->getOssClient();
        $this->bucket = getenv('OSS_BUCKET');
    }
    
    protected function success($data, $contentType = "application/json") {
        return array(
            "statusCode" => 200,
            'headers' => array("Content-Type" => $contentType),
            'isBase64Encoded' => false,
            "body" => json_encode($data)
        );
    }
    
    protected function error($message, $statusCode = 400) {
        return array(
            "statusCode" => $statusCode,
            'headers' => array("Content-Type" => "application/json"),
            'isBase64Encoded' => false,
            "body" => json_encode(array("error" => $message))
        );
    }
} 