import {
  Alert,
  Badge,
  Button,
  Card,
  Dialog,
  PageHeader,
  TextField,
  useToast,
} from '@ts-business-app-starter/ui';
import { useState } from 'react';

export function UiPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { notify } = useToast();
  return (
    <div className="admin-page">
      <PageHeader
        eyebrow="Shared workspace"
        title="UI 组件"
        description="Admin 与 Web 共享同一套设计 Token 和无业务语义的交互原语。"
        actions={<Button onClick={() => setDialogOpen(true)}>打开弹窗</Button>}
      />
      <div className="showcase-grid">
        <Card className="showcase-card">
          <h2>按钮</h2>
          <div className="showcase-row">
            <Button onClick={() => notify('操作已完成。', 'success')}>主要操作</Button>
            <Button variant="secondary">次要操作</Button>
            <Button variant="ghost">轻量操作</Button>
            <Button variant="danger">危险操作</Button>
          </div>
        </Card>
        <Card className="showcase-card">
          <h2>状态与反馈</h2>
          <div className="showcase-row">
            <Badge tone="brand">进行中</Badge>
            <Badge tone="success">已完成</Badge>
            <Badge tone="warning">需注意</Badge>
            <Badge tone="danger">失败</Badge>
          </div>
          <Alert tone="info">组件只表达交互与视觉，不感知行业业务。</Alert>
        </Card>
        <Card className="showcase-card">
          <h2>表单</h2>
          <div className="showcase-form">
            <TextField label="名称" placeholder="输入显示名称" />
            <TextField
              label="只读字段"
              value="由应用层控制"
              readOnly
              hint="校验规则由业务表单提供。"
            />
          </div>
        </Card>
      </div>
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="可复用弹窗"
        description="可放入任意模块的确认或表单内容。"
      >
        <Alert tone="success">键盘 Escape、遮罩点击和语义属性已内置。</Alert>
        <div className="dialog-actions">
          <Button variant="secondary" onClick={() => setDialogOpen(false)}>
            取消
          </Button>
          <Button
            onClick={() => {
              setDialogOpen(false);
              notify('弹窗操作已确认。', 'success');
            }}
          >
            确认
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
