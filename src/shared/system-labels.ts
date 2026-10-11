import type { SiteLanguage } from './i18n';

// This compatibility table is used only for known domain labels, never user content.
const labels: Record<string, string> = {
  '文字': 'Writing', '同人文': 'Fan fiction', '小说': 'Fiction', '插画': 'Illustration', '画作': 'Artwork', '漫画': 'Comic', '音乐': 'Music', '视频': 'Video', '其他': 'Other',
  '待审核': 'Pending review', '审核已通过': 'Approved', '已通过': 'Approved', '已撤回': 'Withdrawn', '已完成': 'Completed', '已拒绝': 'Rejected', '已驳回': 'Rejected', '未开始': 'Not started', '草稿': 'Draft', '已提交': 'Submitted', '需修改': 'Changes requested',
  '未启用': 'Disabled', '尚未开始': 'Not started', '开放中': 'Open', '已结束': 'Ended', '报名未开放': 'Registration is closed', '报名尚未开始': 'Registration has not started', '报名开放中': 'Registration is open', '报名已结束': 'Registration has ended',
  '报名开放': 'Registration', '发布时点认领开放': 'Slot selection', '发布时点变更 / 释放开放': 'Slot changes and cancellations', '预告资料提交开放': 'Work details submission', '审查说明提交开放': 'Review submission', '公开发布开放': 'Public release',
  '可认领': 'Available', '开放': 'Available', '已认领': 'Reserved', '已锁定': 'Locked', '已释放': 'Released', '可选': 'Available', '已预留': 'Reserved', '已确认': 'Confirmed', '不可用': 'Unavailable',
  '微信': 'WeChat', '邮箱': 'Email', '必填': 'Required', '必选': 'Required', '选填': 'Optional', '署名': 'Display name', '联系方式类型': 'Contact method', '联系账号': 'Contact details', '联系邮箱': 'Contact email', '备用联系方式': 'Backup contact', '参加形式': 'Work format', '创作意向': 'Creative plan', '发布时间': 'Release time',
  '填写作品展示使用的署名': 'Name to show with your work', '数字 UID 或 B站主页链接，供相邻作者联系': 'Numeric UID or Bilibili profile URL, for contact with neighboring creators', '用于主催联系，选填': 'For contact with the organizers (optional)', '选择联系方式': 'Choose a contact method', '填写号码、邮箱地址或其他联系信息': 'Enter your number, email address or other contact details', '例如：微信 xxx，选填': 'For example: a WeChat ID (optional)',
  '请填写署名。': 'Enter your display name.', '请填写 B站主页链接或数字 UID，不能填写昵称。': 'Enter a Bilibili profile URL or numeric UID, not a nickname.', '请填写有效联系邮箱，或留空。': 'Enter a valid contact email, or leave it blank.', '请选择联系方式。': 'Choose a contact method.', '请填写联系账号。': 'Enter your contact details.', '请检查备用联系方式。': 'Check your backup contact details.', '请选择参加形式。': 'Choose a work format.', '请简要描述准备创作什么。': 'Briefly describe what you plan to create.', '请填写完整链接，例如 https://example.com/works。': 'Enter a complete URL, such as https://example.com/works.', '请检查给主催的话。': 'Check your message to the organizers.', '请选择一个可用的发布时间。': 'Choose an available release time.',
  'B站主页链接或 UID': 'Bilibili profile URL or UID', '作品或主页链接': 'Work or profile URL', '给主催的话': 'Message to the organizers',
  '参与已完成': 'Participation completed', '报名已通过': 'Registration approved', '报名待审核': 'Registration pending review', '审核未通过': 'Not approved', '未报名': 'Not registered',
  '待认领': 'Available', '不可选择': 'Unavailable', '署名待确认': 'Credit name pending confirmation', '署名待补充': 'Credit name pending', '暂不可选': 'Currently unavailable',
  '作品标题': 'Work title', '作品简介': 'Work description', '作品形式': 'Work format', '作品内容说明': 'Work description for review', '内容提醒': 'Content warnings', '审查说明': 'Notes for review', '公开署名': 'Public credit name', '作品链接': 'Work link',
  '个人档案署名': 'Profile display name', '内容概述': 'Content summary',
  '匿名': 'Anonymous',
};

const chineseLabels = new Map<string, string>();
for (const [chinese, english] of Object.entries(labels)) if (!chineseLabels.has(english)) chineseLabels.set(english, chinese);

export function localizeSystemLabel(text: string, language: SiteLanguage = 'zh-CN'): string {
  return language === 'en' ? labels[text] ?? text : chineseLabels.get(text) ?? text;
}
