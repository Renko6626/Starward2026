export const ACTIVITY_RULES_VERSION = "2026-10-10-v2";
export const ACTIVITY_RULES_UPDATED_AT = "2026-10-10";
export const ACTIVITY_RULES_ACCEPTANCE_HEADER = "x-starward-rules-version";
export const NEW_ACCOUNT_RESPONSE_HEADER = "x-starward-account-created";
export const ACTIVITY_RULES_TITLE = "逐星巡礼活动规则";
export const ACTIVITY_RULES_CONSENT_NOTICE = "了解纪念册制作及作品使用授权，知悉发行与收入处理方案将另行协商公布。";
export const ACTIVITY_RULES_CONSENT_TEXT = `我已阅读并同意《逐星巡礼活动规则》，${ACTIVITY_RULES_CONSENT_NOTICE}`;

export function activityRulesConsentHeaders(accepted: boolean): Record<string, string> {
  return accepted ? { [ACTIVITY_RULES_ACCEPTANCE_HEADER]: ACTIVITY_RULES_VERSION } : {};
}

export const activityRulesSections = [
  {
    id: "general", title: "一、参与主题与方式",
    paragraphs: [
      "逐星巡礼是以秘封俱乐部成员（堇子、莲子、梅莉）为主题的创作接力，接受画作、同人文、视频等形式的作品。",
      "参与者通过本网站报名，按约定时点发布作品。同一名创作者可以多次投稿，活动不限制参与人数；时点已满时，请联系管理员追加棒数。",
    ],
  },
  {
    id: "rights", title: "二、纪念册、作品权利与收入处理",
    paragraphs: [
      "组委会计划将接力作品汇编为纪念册。参与本接力，视为允许组委会将投稿作品收录并印制于本次活动的纪念册。",
      "作品的著作权及相关权利仍归原权利人所有。参加接力或纪念册制作，不代表向组委会转让作品著作权；超出本次纪念册制作所需的作品使用，应与相关作者另行协商。",
      "纪念册可能通过售卖方式发行，原则上不以营利为目的。制作规模、售价、成本核算，以及收入和结余的处理方式尚未确定。组委会将在方案完善后与参与者协商，并公布最终方案。",
    ],
  },
  {
    id: "generative-ai", title: "三、生成式 AI 内容限制",
    paragraphs: ["禁止以生成式 AI 生成内容为主体的创作。这一要求适用于图像、文字、音频、视频等投稿形式。"],
  },
  {
    id: "content", title: "四、内容要求",
    paragraphs: [
      "允许 CP 向作品投稿。",
      "作品不得包含露骨色情（R-18）、血腥猎奇内容（R-18G）或露骨的性暗示。",
      "禁止提交违背公序良俗，或具有明显侮辱贬损、恶意引战性质的内容。作品应避免严重偏离角色通常形象，以及可能引发较大争议、不适合本活动公开展示的描写。",
      "组委会将结合活动主题、内容要求及公开展示需要进行审核。对不符合要求的作品，有权要求修改、驳回投稿或要求撤回，并向作者说明理由。",
    ],
  },
  {
    id: "requirements", title: "五、各类作品的形式要求",
    paragraphs: [
      "画作：画幅和创作形式不限，手绘、数字绘画均可。建议兼顾同人志的印刷和排版需要，便于后续制作纪念册。",
      "同人文：篇幅限 500—50000，形式不限。作品在接力前不得在其他平台或同人志中公开，包括 bilibili、LOFTER 等。",
      "视频：时长和形式不限，应符合本活动的主题、内容要求及生成式 AI 内容限制。",
    ],
  },
  {
    id: "deadline", title: "六、完成时间与补救安排",
    paragraphs: [
      "作品须在 2026年11月11日 23:00 前完成。",
      "若届时作品已接近完成，但仍需在次日继续创作，且能够保证在本人接力时点前至少 3 小时完成，可以联系组委会申请补救安排。",
    ],
  },
  {
    id: "review", title: "七、作品审核",
    paragraphs: [
      "组委会将在接力前一天审核作品，检查作品是否符合活动主题、内容要求及生成式 AI 内容限制。不符合要求的作品可被驳回，或被要求撤回。",
      "组委会负责说明和解释本活动规则。纪念册发行、收入处理及作品使用范围等事项，按本规则约定与参与者协商。",
    ],
  },
] as const;
