import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Badge, Button, DataTable, TextField } from './index.js';

describe('shared UI', () => {
  it('renders accessible form and action primitives', () => {
    const markup = renderToStaticMarkup(
      <>
        <TextField label="邮箱" type="email" error="格式错误" />
        <Button>提交</Button>
      </>,
    );
    expect(markup).toContain('aria-invalid="true"');
    expect(markup).toContain('提交');
  });

  it('renders typed table rows', () => {
    const markup = renderToStaticMarkup(
      <DataTable
        rows={[{ id: '1', status: 'active' }]}
        rowKey={(row) => row.id}
        columns={[
          {
            key: 'status',
            header: '状态',
            render: (row) => <Badge tone="success">{row.status}</Badge>,
          },
        ]}
      />,
    );
    expect(markup).toContain('<th>状态</th>');
    expect(markup).toContain('active');
  });
});
