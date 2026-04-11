<template>
  <div class="dashboard">
    <div class="header-container">
      <h2>AI 相关核心岗位全景图谱：替代风险、薪资分布与技能阶梯 (2025-2026)</h2>
      <div class="controls">
        <label for="company-filter">筛选公司规模：</label>
        <select id="company-filter" v-model="selectedCompanySize" @change="updateDashboard">
          <option value="All">🌐 全部公司</option>
          <option value="Startup">🚀 初创公司 (Startup)</option>
          <option value="Enterprise">🏢 大型企业 (Enterprise)</option>
        </select>
      </div>
    </div>

    <p class="subtitle">
      💡 <b>高级多视图交互：</b> 悬停左侧网络节点，可观察右侧<b>薪资榜</b>的实时联动；按住节点可拖拽排版；滚轮缩放画布
    </p>
    
    <div class="charts-layout">
      <div class="sankey-card">
        <h3 class="bar-title">岗位行业流向与AI替代风险评估</h3>
        <div ref="sankeyRef" class="sankey-container"></div>
      </div>
      
      <div class="bar-chart-card">
        <h3 class="bar-title">{{ barChartTitle }}</h3>
        <div ref="barRef" class="bar-container"></div>
      </div>
    </div>

    <div class="skills-insight-card">
      <h3 class="section-title">
        🛠️ 经验与核心技能图谱 <span class="hint-text">(交互方法：点击左侧经验柱，查看右侧经验对应技能需求)</span>
      </h3>
      <div class="skills-layout">
        <div class="exp-card">
          <h4 class="sub-chart-title">岗位经验需求分布</h4>
          <div ref="expRef" class="exp-chart-container"></div>
        </div>
        <div class="skills-card">
          <h4 class="sub-chart-title">{{ skillsChartTitle }}</h4>
          <div ref="skillsRef" class="skills-chart-container"></div>
        </div>
      </div>
    </div>

    <div style="margin-top: 30px; background: white; border-radius: 16px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05); padding: 25px 35px; display: flex; flex-direction: column; gap: 15px; text-align: left !important;">
      
      <div style="font-size: 18px; font-weight: bold; color: #1e293b; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; text-align: left !important;">
        📌 注：
      </div>
      
      <div style="display: flex; flex-direction: row; gap: 40px; width: 100%; margin-top: 5px;">
        
        <div style="flex: 1;">
          <h4 style="margin: 0 0 15px 0; color: #1e293b; font-size: 16px; text-align: left !important;">📊 左侧第一张图（流向图）节点含义：</h4>
          <ul style="margin: 0; padding-left: 24px; list-style-type: disc; color: #475569; font-size: 14px; line-height: 1.8; text-align: left !important;">
            <li style="margin-bottom: 8px;"><b>左侧列：AI 核心职位</b> —— 当前市场上活跃的各类 AI 相关岗位。</li>
            <li style="margin-bottom: 8px;"><b>中间列：所属行业分布</b> —— 大量雇佣上述岗位的产业领域。</li>
            <li style="margin-bottom: 8px;"><b>右侧列：AI替代风险等级</b> —— 评估该岗位在未来几年内被下一代 AI 完全取代的概率（<span style="color:#e74c3c;font-weight:bold;">高</span> / <span style="color:#f39c12;font-weight:bold;">中</span> / <span style="color:#2ecc71;font-weight:bold;">低</span>）。</li>
          </ul>
        </div>
        
        <div style="flex: 1;">
          <h4 style="margin: 0 0 15px 0; color: #1e293b; font-size: 16px; text-align: left !important;">📊 右侧与下方图表交互方法：</h4>
          <ul style="margin: 0; padding-left: 24px; list-style-type: disc; color: #475569; font-size: 14px; line-height: 1.8; text-align: left !important;">
            <li style="margin-bottom: 8px;"><b>右侧薪资图表：</b> 鼠标悬停左边第一张图的任意节点或连线上，右侧薪资榜单会显示节点对应数据。</li>
            <li style="margin-bottom: 8px;"><b>下方经验与技能联动图：</b> 点击左下方经验柱，右侧的核心技能榜单会显示该阶段的核心技能。</li>
          </ul>
        </div>
        
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import * as d3 from 'd3';
import { sankey, sankeyLinkHorizontal } from 'd3-sankey';

// DOM Refs
const sankeyRef = ref(null);
const barRef = ref(null);
const expRef = ref(null);
const skillsRef = ref(null);

// 状态变量
const selectedCompanySize = ref("All");
const currentDataCount = ref(0);
const barChartTitle = ref("大盘全局平均薪资 Top 5");
const skillsChartTitle = ref("大盘全局 Top 10 核心技能");

// 数据缓存
let cachedRawData = [];
let globalFilteredData = [];
let selectedExp = null; // 用于记录当前选中的经验层级

// 调色板
const baseJobColors = d3.scaleOrdinal([...d3.schemeTableau10, ...d3.schemeDark2]);
const industryColors = d3.scaleOrdinal(d3.schemeSet2);

function getJobColor(jobName) {
  if (jobName === 'Synthetic Data Engineer') return '#8559ab'; 
  if (jobName === 'Machine Learning Engineer') return '#166534'; 
  if (jobName === 'Autonomous Systems Researcher') return '#c026d3';
  if (jobName === 'Cognitive Computing Lead') return '#d584ac';
  return baseJobColors(jobName);
}

function getNodeColor(d) {
  if (d.category === 'Risk') {
    const nameLower = d.name.toLowerCase();
    if (nameLower.includes('high')) return '#e74c3c';
    if (nameLower.includes('medium')) return '#f39c12';
    if (nameLower.includes('low')) return '#2ecc71';
    return '#bdc3c7';
  }
  if (d.category === 'Industry') {
    if (d.name === 'Tech') return '#3b82f6'; 
    if (d.name === 'Finance') return '#6fe0d6'; 
    if (d.name === 'Retail') return '#ffd375'; 
    if (d.name === 'Manufacturing') return '#75baff'; 
    if (d.name === 'Healthcare') return '#b9a7e6'; 
    if (d.name === 'Autonomous Systems Researcher') return '#b9a7e6'; 
    return industryColors(d.name);
  }
  return getJobColor(d.name);
}

// 🌟 辅助函数：安全提取字段
function getExpLevel(row) {
  let val = row['Experience'] || row['Experience_Level'] || row['Experience Level'];
  return val ? String(val).trim() : 'Unknown';
}
function getSkillsList(row) {
  let val = row['Top_Skills'] || row['Top Skills'] || row['Skills'] || '';
  return val.split(/[,;]/).map(s => s.trim()).filter(s => s.length > 0);
}

onMounted(() => {
  d3.csv(`${import.meta.env.BASE_URL}data/ai_job_market_2026.csv`).then(data => {
    cachedRawData = data;
    updateDashboard(); 
  }).catch(error => console.error("加载 CSV 文件出错:", error));
  
  window.addEventListener('resize', updateDashboard);
});

function updateDashboard() {
  if (cachedRawData.length === 0) return;

  globalFilteredData = cachedRawData;
  if (selectedCompanySize.value !== "All") {
    globalFilteredData = cachedRawData.filter(row => {
      const sizeStr = String(row['Company_Size'] || '').toLowerCase();
      if (selectedCompanySize.value === "Startup") return sizeStr.includes("startup") || sizeStr.includes("small") || sizeStr.includes("1-50");
      if (selectedCompanySize.value === "Enterprise") return sizeStr.includes("enterprise") || sizeStr.includes("large") || sizeStr.includes("conglomerate") || sizeStr.includes("+");
      return true;
    });
  }
  currentDataCount.value = globalFilteredData.length;
  
  // 切换公司规模时，重置选中的经验状态
  selectedExp = null;
  skillsChartTitle.value = "大盘全局 Top 10 核心技能";

  drawSankey();
  barChartTitle.value = "大盘全局平均薪资 Top 5";
  drawBarChart(globalFilteredData);
  
  // 🌟 绘制新的两张表
  drawExperienceChart();
  drawSkillsChart();
}

// ==========================================
// 🌟 绘制下方左侧图：经验分布柱状图 (可点击)
// ==========================================
let expSvg = null;
function drawExperienceChart() {
  const container = d3.select(expRef.value);
  const width = container.node().getBoundingClientRect().width || 400;
  const height = 350;
  const margin = { top: 20, right: 30, bottom: 40, left: 100 };

  // 统计经验层级
  // ✅ 将上面这段完全替换为按“业务职级”排序的代码：
  const expCounts = d3.rollup(globalFilteredData, v => v.length, getExpLevel);
  
  // 定义经验等级的严格从高到低排序字典
  const expOrder = { "Executive": 1, "Senior": 2, "Mid": 3, "Entry": 4 };
  
  let expData = Array.from(expCounts, ([name, count]) => ({name, count}))
                     .filter(d => d.name !== 'Unknown')
                     .sort((a, b) => {
                       const rankA = expOrder[a.name] || 99; // 找不到的放最后
                       const rankB = expOrder[b.name] || 99;
                       return rankA - rankB; // 排名数字小的（高级别）在最上面
                     });

  if (!expSvg) {
    container.selectAll("*").remove();
    expSvg = container.append("svg").attr("width", "100%").attr("height", "100%").attr("viewBox", `0 0 ${width} ${height}`);
    expSvg.append("g").attr("class", "x-axis");
    expSvg.append("g").attr("class", "y-axis");
  }

  const x = d3.scaleLinear().domain([0, d3.max(expData, d => d.count) || 10]).range([margin.left, width - margin.right]);
  const y = d3.scaleBand().domain(expData.map(d => d.name)).range([margin.top, height - margin.bottom]).padding(0.3);

  expSvg.selectAll(".bar")
    .data(expData, d => d.name)
    .join(
      enter => enter.append("rect")
        .attr("class", "bar")
        .attr("x", x(0))
        .attr("y", d => y(d.name))
        .attr("height", y.bandwidth())
        .attr("fill", "#8b5cf6") // 紫色主题
        .attr("rx", 4)
        .style("cursor", "pointer")
        .attr("opacity", d => selectedExp === null || selectedExp === d.name ? 1 : 0.3)
        // 🌟 点击联动逻辑
        .on("click", function(event, d) {
          selectedExp = selectedExp === d.name ? null : d.name; // Toggle 点击
          skillsChartTitle.value = selectedExp ? `【${selectedExp}】阶段 Top 10 技能` : "大盘全局 Top 10 核心技能";
          drawExperienceChart(); // 重绘自己以更新透明度
          drawSkillsChart();     // 联动右侧技能图
        })
        .call(enter => enter.transition().duration(500).attr("width", d => x(d.count) - x(0))),
      update => update
        .attr("opacity", d => selectedExp === null || selectedExp === d.name ? 1 : 0.3)
        .call(update => update.transition().duration(500)
          .attr("y", d => y(d.name))
          .attr("height", y.bandwidth())
          .attr("width", d => x(d.count) - x(0))),
      exit => exit.transition().duration(300).attr("width", 0).remove()
    );

  // 添加柱子上的数值
  expSvg.selectAll(".label")
    .data(expData, d => d.name)
    .join(
      enter => enter.append("text").attr("class", "label")
        .attr("x", x(0)).attr("y", d => y(d.name) + y.bandwidth() / 2).attr("dy", "0.35em").attr("dx", "5px")
        .attr("fill", "white").style("font-size", "12px").style("font-weight", "bold").style("pointer-events", "none")
        .text(d => d.count).call(enter => enter.transition().duration(500).attr("x", d => x(d.count) > x(0) + 30 ? x(0) + 5 : x(d.count) + 5).attr("fill", d => x(d.count) > x(0) + 30 ? "white" : "#475569")),
      update => update.text(d => d.count).call(update => update.transition().duration(500).attr("y", d => y(d.name) + y.bandwidth() / 2).attr("x", d => x(d.count) > x(0) + 30 ? x(0) + 5 : x(d.count) + 5).attr("fill", d => x(d.count) > x(0) + 30 ? "white" : "#475569")),
      exit => exit.remove()
    );

  expSvg.select(".x-axis").attr("transform", `translate(0,${height - margin.bottom})`).transition().duration(500).call(d3.axisBottom(x).ticks(5));
  expSvg.select(".y-axis").attr("transform", `translate(${margin.left},0)`).transition().duration(500).call(d3.axisLeft(y).tickSizeOuter(0)).selectAll("text").style("font-size", "13px").style("fill", "#334155");
}

// ==========================================
// 🌟 绘制下方右侧图：核心技能排行 (接收联动)
// ==========================================
let skillsSvg = null;
function drawSkillsChart() {
  const container = d3.select(skillsRef.value);
  const width = container.node().getBoundingClientRect().width || 600;
  const height = 350;
  const margin = { top: 20, right: 80, bottom: 40, left: 160 };

  // 1. 拦截数据：如果左侧点选了经验，就只看该经验的数据
  let targetData = selectedExp ? globalFilteredData.filter(d => getExpLevel(d) === selectedExp) : globalFilteredData;

  // 2. 统计技能频次
  const skillCounts = new Map();
  targetData.forEach(row => {
    getSkillsList(row).forEach(skill => {
      skillCounts.set(skill, (skillCounts.get(skill) || 0) + 1);
    });
  });

  // 3. 排序并取 Top 10
  let skillsData = Array.from(skillCounts, ([name, count]) => ({name, count}))
                        .sort((a, b) => b.count - a.count)
                        .slice(0, 10);

  if (!skillsSvg) {
    container.selectAll("*").remove();
    skillsSvg = container.append("svg").attr("width", "100%").attr("height", "100%").attr("viewBox", `0 0 ${width} ${height}`);
    skillsSvg.append("g").attr("class", "x-axis");
    skillsSvg.append("g").attr("class", "y-axis");
  }

  const x = d3.scaleLinear().domain([0, d3.max(skillsData, d => d.count) || 10]).range([margin.left, width - margin.right]);
  const y = d3.scaleBand().domain(skillsData.map(d => d.name)).range([margin.top, height - margin.bottom]).padding(0.2);

  skillsSvg.selectAll(".skill-bar")
    .data(skillsData, d => d.name)
    .join(
      enter => enter.append("rect")
        .attr("class", "skill-bar")
        .attr("x", x(0)).attr("y", d => y(d.name)).attr("height", y.bandwidth())
        .attr("fill", "#0ea4e97e") // 科技蓝色
        .attr("rx", 4)
        .call(enter => enter.transition().duration(500).attr("width", d => x(d.count) - x(0))),
      update => update.call(update => update.transition().duration(500)
        .attr("y", d => y(d.name)).attr("height", y.bandwidth()).attr("width", d => x(d.count) - x(0))),
      exit => exit.transition().duration(300).attr("width", 0).remove()
    );

  // 技能条上的文字
  skillsSvg.selectAll(".skill-label")
    .data(skillsData, d => d.name)
    .join(
      enter => enter.append("text").attr("class", "skill-label")
        .attr("x", d => x(d.count) + 8).attr("y", d => y(d.name) + y.bandwidth() / 2).attr("dy", "0.35em")
        .attr("fill", "#0284c7").style("font-size", "12px").style("font-weight", "bold")
        .text(d => `${d.count} 岗`).style("opacity", 0).call(enter => enter.transition().duration(500).style("opacity", 1).attr("x", d => x(d.count) + 8)),
      update => update.text(d => `${d.count} 岗`).call(update => update.transition().duration(500).attr("y", d => y(d.name) + y.bandwidth() / 2).attr("x", d => x(d.count) + 8)),
      exit => exit.transition().duration(200).style("opacity", 0).remove()
    );

  skillsSvg.select(".x-axis").attr("transform", `translate(0,${height - margin.bottom})`).transition().duration(500).call(d3.axisBottom(x).ticks(5));
  skillsSvg.select(".y-axis").attr("transform", `translate(${margin.left},0)`).transition().duration(500).call(d3.axisLeft(y).tickSizeOuter(0)).selectAll("text").style("font-size", "12px").style("fill", "#334155").style("font-weight", "500");
}


// ==========================================
// 绘制右侧副视图 (联动薪资柱状图) - 保持原样
// ==========================================
let barSvg = null; 
function drawBarChart(dataset) {
  const container = d3.select(barRef.value);
  const containerWidth = container.node().getBoundingClientRect().width || 600;
  const width = containerWidth; 
  const height = 800; 
  const margin = { top: 20, right: 40, bottom: 30, left: 240 }; 

  const salaryMap = d3.rollup(dataset,
    v => d3.mean(v, d => Number(String(d['Salary_USD'] || 0).replace(/[^0-9.-]+/g,""))),
    d => d['Job_Title'] || d['Job Title'] || "Unknown"
  );
  
  let barData = Array.from(salaryMap, ([job, avgSalary]) => ({job, avgSalary}));
  barData = barData.filter(d => !isNaN(d.avgSalary)).sort((a, b) => b.avgSalary - a.avgSalary).slice(0, 5);

  if (!barSvg) {
    container.selectAll("*").remove();
    barSvg = container.append("svg").attr("width", "100%").attr("height", "100%").attr("viewBox", `0 0 ${width} ${height}`).attr("preserveAspectRatio", "xMidYMid meet");
    barSvg.append("g").attr("class", "x-axis");
    barSvg.append("g").attr("class", "y-axis");
  } else {
    barSvg.attr("viewBox", `0 0 ${width} ${height}`);
  }

  const x = d3.scaleLinear().domain([0, d3.max(barData, d => d.avgSalary) || 100000]).range([margin.left, width - margin.right]);
  const maxBarHeight = 55; 
  const y = d3.scaleBand().domain(barData.map(d => d.job)).range([margin.top, margin.top + barData.length * (maxBarHeight + 20)]).padding(0.2);
  const formatCurrency = d3.format("$,.0f");

  barSvg.selectAll(".bar-group")
    .data(barData, d => d.job)
    .join(
      enter => {
        const g = enter.append("g").attr("class", "bar-group").attr("opacity", 1);
        g.append("rect").attr("x", x(0)).attr("y", d => y(d.job)).attr("height", y.bandwidth()).attr("width", 0).attr("fill", d => getJobColor(d.job)).attr("rx", 6).transition().duration(500).attr("width", d => x(d.avgSalary) - x(0));
        g.append("text").attr("class", "bar-text").attr("x", x(0) + 12).attr("y", d => y(d.job) + y.bandwidth() / 2).attr("dy", "0.35em").attr("fill", "white").style("font-size", "15px").style("font-weight", "bold").text(d => formatCurrency(d.avgSalary)).transition().duration(500).attr("x", d => Math.max(x(0) + 12, x(d.avgSalary) - 90));
        return g;
      },
      update => {
        update.interrupt().attr("opacity", 1); 
        update.select("rect").transition().duration(500).attr("y", d => y(d.job)).attr("height", y.bandwidth()).attr("width", d => x(d.avgSalary) - x(0)).attr("fill", d => getJobColor(d.job)); 
        update.select(".bar-text").transition().duration(500).attr("y", d => y(d.job) + y.bandwidth() / 2).text(d => formatCurrency(d.avgSalary)).attr("x", d => Math.max(x(0) + 12, x(d.avgSalary) - 90));
        return update;
      },
      exit => exit.transition().duration(300).attr("opacity", 0).remove()
    );

  barSvg.select(".x-axis").attr("transform", `translate(0,${margin.top + barData.length * (maxBarHeight + 20)})`).transition().duration(500).call(d3.axisBottom(x).ticks(5).tickFormat(d3.format("~s"))).selectAll("text").style("font-size", "12px");
  barSvg.select(".y-axis").attr("transform", `translate(${margin.left},0)`).transition().duration(500).call(d3.axisLeft(y).tickSizeOuter(0)).selectAll("text").style("font-size", "14px").style("font-weight", "bold").style("fill", "#334155"); 
}

// ==========================================
// 绘制左侧主视图 (Sankey图) - 保持原样
// ==========================================
function drawSankey() {
  const container = d3.select(sankeyRef.value);
  const width = container.node().getBoundingClientRect().width || 1000;
  const height = 750; 
  
  container.selectAll("*").remove();

  let tooltip = d3.select("body").select(".custom-tooltip");
  if (tooltip.empty()) {
    tooltip = d3.select("body").append("div").attr("class", "custom-tooltip").style("opacity", 0);
  }

  const svg = container.append("svg").attr("width", "100%").attr("height", "100%").attr("viewBox", `0 0 ${width} ${height}`).attr("preserveAspectRatio", "xMidYMid meet").attr("style", "font-family: sans-serif; cursor: grab;"); 
  const mainGroup = svg.append("g");
  svg.call(d3.zoom().scaleExtent([0.5, 3]).on("zoom", (event) => mainGroup.attr("transform", event.transform))); 

  const sankeyGenerator = sankey().nodeId(d => d.id).nodeWidth(24).nodePadding(18).extent([[10, 10], [width - 10, height - 20]]);

  const jobCounts = d3.rollup(globalFilteredData, v => v.length, d => d.Job_Title || d[' Job_Title']); 
  const topJobsSet = new Set(Array.from(jobCounts).sort((a, b) => b[1] - a[1]).slice(0, 15).map(d => d[0]));
  
  const nodesMap = new Map();
  const linksMap = new Map();

  function getOrAddNode(name, category) {
    if(!name) name = "Unknown";
    const uniqueId = `${name}_${category}`;
    if (!nodesMap.has(uniqueId)) { nodesMap.set(uniqueId, { name, category, id: nodesMap.size }); }
    return nodesMap.get(uniqueId).id;
  }

  globalFilteredData.forEach(row => {
    let rawJob = row['Job_Title'] || row['Job Title'] || "Unknown";
    let rawIndustry = row['Industry'] || "Unknown Industry";
    let rawRisk = row['Automation_Risk'] || row['Automation Risk'] || "Unknown Risk";

    let job = topJobsSet.has(rawJob) ? rawJob : "Other Roles";
    let jobNode = getOrAddNode(job, "Job");
    let industryNode = getOrAddNode(rawIndustry, "Industry");
    let riskNode = getOrAddNode(rawRisk, "Risk");

    let link1Key = `${jobNode}-${industryNode}`;
    linksMap.set(link1Key, { source: jobNode, target: industryNode, value: (linksMap.get(link1Key)?.value || 0) + 1 });

    let link2Key = `${industryNode}-${riskNode}`;
    linksMap.set(link2Key, { source: industryNode, target: riskNode, value: (linksMap.get(link2Key)?.value || 0) + 1 });
  });

  const graphData = { nodes: Array.from(nodesMap.values()).sort((a, b) => a.id - b.id), links: Array.from(linksMap.values()) };
  if (graphData.nodes.length === 0) return;

  const { nodes, links } = sankeyGenerator(graphData);

  const linkPath = mainGroup.append("g").attr("fill", "none").attr("stroke-opacity", 0.3).selectAll("g").data(links).join("path").attr("class", "link").attr("d", sankeyLinkHorizontal()).attr("stroke", d => getNodeColor(d.source)).attr("stroke-width", d => Math.max(1, d.width));
    
  const nodeGroup = mainGroup.append("g").selectAll("g").data(nodes).join("g").attr("class", "node"); 

  nodeGroup.append("rect").attr("x", d => d.x0).attr("y", d => d.y0).attr("height", d => Math.max(1, d.y1 - d.y0)).attr("width", d => d.x1 - d.x0).attr("fill", d => getNodeColor(d)).attr("stroke", "#000").attr("stroke-opacity", 0.1);
  nodeGroup.append("text").attr("x", d => d.x0 < width / 2 ? d.x1 + 8 : d.x0 - 8).attr("y", d => (d.y1 + d.y0) / 2).attr("dy", "0.35em").attr("text-anchor", d => d.x0 < width / 2 ? "start" : "end").style("font", "13px sans-serif").style("pointer-events", "none").text(d => d.name);

  nodeGroup.on("mouseenter", function(event, d) {
    tooltip.transition().duration(50).style("opacity", 1);
    const percentage = ((d.value / globalFilteredData.length) * 100).toFixed(1);
    tooltip.html(`<strong style="font-size:15px; color:${getNodeColor(d)}">${d.name}</strong><br/>涉及数量: <b>${d.value}</b><br/>整体占比: <b>${percentage}%</b>`).style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 15) + "px");

    linkPath.style("stroke-opacity", 0.05);
    nodeGroup.style("opacity", 0.3);
    d3.select(this).style("opacity", 1);
    linkPath.filter(l => l.source.id === d.id || l.target.id === d.id).style("stroke-opacity", 0.75).style("stroke", "#e74c3c").each(function(l) { nodeGroup.filter(n => n.id === l.source.id || n.id === l.target.id).style("opacity", 1); });

    let localSubset = globalFilteredData.filter(row => {
      let rawJob = row['Job_Title'] || row['Job Title'] || "Unknown";
      let jobName = topJobsSet.has(rawJob) ? rawJob : "Other Roles";
      if (d.category === 'Job') return jobName === d.name;
      if (d.category === 'Industry') return row['Industry'] === d.name;
      if (d.category === 'Risk') return (row['Automation_Risk'] || row['Automation Risk']) === d.name;
      return true;
    });

    barChartTitle.value = `【${d.name}】平均薪资 Top 5`;
    drawBarChart(localSubset);
  })
  .on("mousemove", function(event) { tooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 15) + "px"); })
  .on("mouseleave", function() {
    tooltip.transition().duration(200).style("opacity", 0);
    linkPath.style("stroke-opacity", 0.3).style("stroke", d => getNodeColor(d.source)); 
    nodeGroup.style("opacity", 1);
    barChartTitle.value = "大盘全局平均薪资 Top 5";
    drawBarChart(globalFilteredData);
  });

  linkPath.on("mouseenter", function(event, d) {
      tooltip.transition().duration(50).style("opacity", 1);
      const linkPercentage = ((d.value / d.source.value) * 100).toFixed(1);
      tooltip.html(`<div style="font-size:13px; color:#666;">数据流向</div><strong style="color:${getNodeColor(d.source)}">${d.source.name}</strong> ➔ <strong style="color:${getNodeColor(d.target)}">${d.target.name}</strong><br/><div style="margin-top:4px;">流向频次: <b>${d.value}</b> (占 <b>${linkPercentage}%</b>)</div>`).style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 15) + "px");
    })
  .on("mousemove", function(event) { tooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 15) + "px"); })
  .on("mouseleave", function() { tooltip.transition().duration(200).style("opacity", 0); });
  nodeGroup.call(d3.drag()
      .subject(d => d)
      .on("start", function() { d3.select(this).raise(); svg.style("cursor", "grabbing"); })
      .on("drag", function(event, d) {
        const nodeHeight = d.y1 - d.y0; 
        d.y0 += event.dy;
        
        // 🌟 核心修复：更严格的上下边界限制
        if (d.y0 < 10) d.y0 = 10; // 顶部不准越过 10
        else if (d.y0 + nodeHeight > height - 20) d.y0 = height - 20 - nodeHeight; // 底部严格限制
        
        d.y1 = d.y0 + nodeHeight; 
        d3.select(this).select("rect").attr("y", d.y0);
        d3.select(this).select("text").attr("y", d.y0 + nodeHeight / 2);
        sankeyGenerator.update(graphData);
        linkPath.attr("d", sankeyLinkHorizontal());
      })
      .on("end", function() { svg.style("cursor", "grab"); })
    );
}
</script>

<style>
/* ... (原有的基础样式不变) ... */
html, body { margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #f8fafc !important; overflow-x: auto; }
#app { max-width: 100% !important; padding: 0 !important; margin: 0 !important; width: 100% !important; display: block !important; }

.dashboard {
  max-width: 1600px; min-width: 1200px; margin: 0 auto; padding: 30px; box-sizing: border-box;
}

.header-container { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.header-container h2 { margin: 0 0 5px 0; color: #0f172a; font-size: 26px; }
.data-badge { display: inline-block; background-color: #e0f2fe; color: #0369a1; padding: 4px 12px; border-radius: 20px; font-size: 14px; font-weight: 600; }
.controls { background: white; padding: 12px 24px; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
.controls select { padding: 8px 16px; font-size: 15px; border-radius: 6px; border: 1px solid #cbd5e1; outline: none; cursor: pointer; }
.subtitle { color: #475569; font-size: 15px; margin-bottom: 25px; }

.charts-layout {
  display: flex; flex-wrap: nowrap; width: 100%; gap: 30px; height: 850px; 
}
.sankey-card { 
  flex: 6.5; 
  background: white; 
  border-radius: 16px; 
  box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05); 
  padding: 25px; 
  position: relative; 
  min-width: 0; 
  display: flex; 
  flex-direction: column; 
  overflow: hidden; /* 🌟 新增：强制把跑出白色卡片的任何东西“咔嚓”剪掉 */
}
.bar-chart-card { flex: 3.5; background: white; border-radius: 16px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05); padding: 25px; display: flex; flex-direction: column; min-width: 0; }
.sankey-container, .bar-container { width: 100%; height: 100%; }
.bar-title { margin: 0 0 15px 0; font-size: 18px; color: #1e293b; text-align: center; border-bottom: 2px solid #f1f5f9; padding-bottom: 15px; }
.node, .link { transition: stroke-opacity 0.2s ease, stroke 0.2s ease, opacity 0.2s ease; }
.node:hover { cursor: grab; }
.node:active { cursor: grabbing; }

.custom-tooltip {
  position: absolute; pointer-events: none; background: rgba(255, 255, 255, 0.98); border: 1px solid #cbd5e1;
  box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1); padding: 16px 20px;
  border-radius: 10px; font-size: 14px; color: #0f172a; line-height: 1.6; z-index: 9999; backdrop-filter: blur(12px);
}

/* 🌟 新增：经验与技能图谱样式 */
.skills-insight-card {
  margin-top: 30px;
  background: white;
  border-radius: 16px;
  box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05);
  padding: 25px 35px;
}
.section-title {
  margin: 0 0 20px 0;
  color: #0f172a;
  font-size: 20px;
  border-bottom: 2px solid #f1f5f9;
  padding-bottom: 15px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.hint-text {
  font-size: 14px;
  color: #64748b;
  font-weight: normal;
}
.skills-layout {
  display: flex;
  gap: 40px;
  height: 400px;
}
.exp-card { flex: 4; display: flex; flex-direction: column; }
.skills-card { flex: 6; display: flex; flex-direction: column; }
.sub-chart-title {
  margin: 0 0 10px 0;
  font-size: 16px;
  color: #334155;
  text-align: center;
}
.exp-chart-container, .skills-chart-container {
  flex: 1;
  width: 100%;
}
.bar:hover {
  filter: brightness(1.1);
}

/* 注释面板样式 */
.annotations-card { margin-top: 30px; background: white; border-radius: 16px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05); padding: 25px 35px; display: flex; flex-direction: row; gap: 40px; }
.annotation-section { flex: 1; }
.annotation-section h4 { margin: 0 0 15px 0; color: #1e293b; font-size: 16px; display: flex; align-items: center; }
.annotation-section ul { margin: 0; padding-left: 24px; list-style-type: disc; color: #475569; font-size: 14px; line-height: 1.8; text-align: left !important; }
.annotation-section li { margin-bottom: 8px; text-align: left !important; }
</style>