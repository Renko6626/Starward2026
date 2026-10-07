// Fictional content from the approved timetable study; no production API.
const works = [
  ['近地轨道上的最后一封信', '白榆', '小说'], ['环形站，晨昏之间', '远山观测室', '插画'],
  ['来自远地点的回声', '零号天线', '音乐'], ['月面值班室', '北窗', '漫画'],
  ['逐星号生活舱图录', '折光工房', '设定集'], ['下一班往返地月之间', '月海邮局', '漫画'],
  ['舷窗之外，蓝色依旧', '安静的近地点', '视频'], ['第七次变轨', '南十字', '小说'],
  ['舱外工作', '弦月', '插画'], ['返航窗口', '纸舟', '小说'],
  ['月背频率', '波形', '音乐'], ['作品预告待公布', '参与者待公布', ''],
  ['第二日的观测记录', '纸上星图', '小说'], ['储备环的午后', '冬青', '插画'],
  ['地月之间', '回声室', '视频'], ['轨道早餐', '小满', '漫画'],
  ['轨道周期', '钟摆', '音乐'], ['维修手册', '蓝图', '设定集'],
  ['静默航段', '夜航', '小说'], ['月海着陆场', '白沙', '插画'],
  ['作品预告待公布', '参与者待公布', ''], ['两分钟延迟', '阿尔法', '漫画'],
  ['地球升起', '旧相机', '视频'], ['作品预告待公布', '参与者待公布', ''],
];

export function mountSchedule() {
  document.querySelector('.ticks').innerHTML = works.map((_, i) => `<i class="${i === 2 ? 'current' : i < 2 ? 'past' : ''}"></i>`).join('');
  document.querySelector('#schedule').innerHTML = [17, 18].map((day, group) => `
    <section class="day" id="day-${day}">
      <header class="day-heading"><h2><span>十月</span><strong>${day}</strong><span>${day === 17 ? '星期六' : '星期日'}</span></h2><span>第 ${group * 12 + 1}—${group * 12 + 12} 棒</span></header>
      <ol>${works.slice(group * 12, group * 12 + 12).map(([title, author, type], index) => {
        const number = group * 12 + index + 1;
        return `<li id="slot-${number}" class="${number === 3 ? 'active' : ''}"><div class="time"><strong>${String(9 + index).padStart(2, '0')}:00</strong><span>第 ${String(number).padStart(2, '0')} 棒</span><small>${number === 3 ? '当前接力' : number < 3 ? '已到发布时点' : '后续接力'}</small></div><div class="work"><h3>${title}</h3><p>${author}${type ? `<span>${type}</span>` : ''}</p></div></li>`;
      }).join('')}</ol>
    </section>`).join('');
  document.querySelector('#search').addEventListener('input', event => {
    const query = event.target.value.trim().toLocaleLowerCase();
    let count = 0;
    document.querySelectorAll('.day li').forEach(row => {
      row.hidden = !row.textContent.toLocaleLowerCase().includes(query);
      if (!row.hidden) count++;
    });
    document.querySelectorAll('.day').forEach(day => { day.hidden = ![...day.querySelectorAll('li')].some(row => !row.hidden); });
    document.querySelector('#empty').hidden = count !== 0;
    document.querySelector('.hud-footer > span').textContent = query ? `找到 ${count} 棒` : '全部 24 棒';
  });
}
