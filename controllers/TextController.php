<?php
require_once __DIR__ . '/BaseController.php';

class TextController extends BaseController {
    private $objectKey;
    
    public function __construct($context) {
        parent::__construct($context);
        $directory = getenv('OSS_DIRECTORY') ?: '3dtext';  // 如果未设置，使用默认值
        $this->objectKey = $directory . '/content.txt';
    }
    
    public function addText($body) {
        $data = json_decode($body, true);
        if (!isset($data['text']) || empty($data['text'])) {
            throw new Exception("缺少text参数");
        }
        
        $this->ossClient->putObject($this->bucket, $this->objectKey, $data['text']);
        return $this->success(array("message" => "文本保存成功"));
    }
    
    public function getText() {
        $content = $this->ossClient->getObject($this->bucket, $this->objectKey);
        return $this->success(array("text" => $content));
    }
} 