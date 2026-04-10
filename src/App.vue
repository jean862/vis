<template>
  <div class="dashboard">
    <div class="header-container">
      <div>
        <h2>AI 岗位自动化风险与薪资全景图 (2025-2026)</h2>
        <span class="data-badge">当前符合条件的数据：<b>{{ currentDataCount }}</b> 条</span>
      </div>
      
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
      💡 <b>高级多视图交互：</b> 悬停左侧网络节点，观察右侧<b>薪资榜</b>的实时联动！按住节点可垂直拖拽排版。
    </p>
    
    <div class="charts-layout">
      <div class="sankey-card">
        <div ref="sankeyRef" class="sankey-container"></div>
      </div>
      
      <div class="bar-chart-card">
        <h3 class="bar-title">{{ barChartTitle }}</h3>
        <div ref="barRef" class="bar-container"></div>
      </div>
    </div>

    <div class="annotations-card">
      <div class="annotation-section">
        <h4>📊 图表节点含义：</h4>
        <ul>
          <li><b>左侧第一列（起点）：AI 相关核心职位</b> —— 当前市场上活跃的各类 AI 相关岗位（如提示词工程师、架构师等）。</li>
          <li><b>中间第二列（枢纽）：所属行业分布</b> —— 大量雇佣上述岗位的产业领域（如科技、金融、医疗等）。</li>
          <li><b>右侧第三列（终点）：自动化风险等级</b> —— 评估该岗位在未来几年内被下一代 AI 完全取代的概率（<span style="color:#e74c3c;font-weight:bold;">高</span> / <span style="color:#f39c12;font-weight:bold;">中</span> / <span style="color:#2ecc71;font-weight:bold;">低</span>）。</li>
        </ul>
      </div>
      <div class="annotation-section">
        <h4>🖱️ 页面交互方式：</h4>
        <ul>
          <li><b>动态筛选：</b> 切换顶部下拉菜单，观察不同规模公司在人才需求和薪资上的差异。</li>
          <li><b>数据钻取：</b> 鼠标悬停在左图的任意节点或连线上，会显示统计数据并高亮数据流向；同时右侧排行榜会瞬间重算，展示该路径下的真实薪资水平。</li>
          <li><b>自由排版：</b> 可用鼠标按住对应节点上下拖拽，自由布局。</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import * as d3 from 'd3';
import { sankey, sankeyLinkHorizontal } from 'd3-sankey';

const sankeyRef = ref(null);
const barRef = ref(null);

const selectedCompanySize = ref("All");
const currentDataCount = ref(0);
const barChartTitle = ref("大盘全局平均薪资 Top 5");

let cachedRawData = [];
let globalFilteredData = [];

const jobColors = d3.scaleOrdinal([...d3.schemeTableau10, ...d3.schemeSet3, ...d3.schemeDark2]);
const industryColors = d3.scaleOrdinal(d3.schemeSet2);

function getJobColor(jobName) {
  if (jobName === 'Synthetic Data Engineer') return '#7e22ce'; 
  return jobColors(jobName);
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
    // 🌟 新增：给 Finance 分配专属的深青色，彻底解决撞色
    if (d.name === 'Finance') return '#9cc254'; 
    if (d.name === 'Retail') return '#aeaf52'; 
    return industryColors(d.name);
  }
  return getJobColor(d.name);
}

onMounted(() => {
  d3.csv("/data/ai_job_market_2026.csv").then(data => {
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

  drawSankey();
  barChartTitle.value = "大盘全局平均薪资 Top 5";
  drawBarChart(globalFilteredData);
}

// ==========================================
// 绘制右侧副视图 (联动柱状图)
// ==========================================
let barSvg = null; 
function drawBarChart(dataset) {
  const container = d3.select(barRef.value);
  
  const containerWidth = container.node().getBoundingClientRect().width || 600;
  const width = containerWidth; 
  const height = 600; 
  const margin = { top: 20, right: 40, bottom: 30, left: 240 }; 

  const salaryMap = d3.rollup(dataset,
    v => d3.mean(v, d => Number(String(d['Salary_USD'] || 0).replace(/[^0-9.-]+/g,""))),
    d => d['Job_Title'] || d['Job Title'] || "Unknown"
  );
  
  let barData = Array.from(salaryMap, ([job, avgSalary]) => ({job, avgSalary}));
  barData = barData.filter(d => !isNaN(d.avgSalary)).sort((a, b) => b.avgSalary - a.avgSalary).slice(0, 5);

  if (!barSvg) {
    container.selectAll("*").remove();
    barSvg = container.append("svg")
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("preserveAspectRatio", "xMidYMid meet");
      
    barSvg.append("g").attr("class", "x-axis");
    barSvg.append("g").attr("class", "y-axis");
  } else {
    barSvg.attr("viewBox", `0 0 ${width} ${height}`);
  }

  const x = d3.scaleLinear()
    .domain([0, d3.max(barData, d => d.avgSalary) || 100000])
    .range([margin.left, width - margin.right]);

  const maxBarHeight = 55; 
  const y = d3.scaleBand()
    .domain(barData.map(d => d.job))
    .range([margin.top, margin.top + barData.length * (maxBarHeight + 20)]) 
    .padding(0.2);

  const formatCurrency = d3.format("$,.0f");

  barSvg.selectAll(".bar-group")
    .data(barData, d => d.job)
    .join(
      enter => {
        const g = enter.append("g").attr("class", "bar-group").attr("opacity", 1);
        
        g.append("rect")
          .attr("x", x(0))
          .attr("y", d => y(d.job))
          .attr("height", y.bandwidth())
          .attr("width", 0) 
          .attr("fill", d => getJobColor(d.job)) 
          .attr("rx", 6)
          .transition().duration(500)
          .attr("width", d => x(d.avgSalary) - x(0));
        
        g.append("text")
          .attr("class", "bar-text")
          .attr("x", x(0) + 12)
          .attr("y", d => y(d.job) + y.bandwidth() / 2)
          .attr("dy", "0.35em")
          .attr("fill", "white")
          .style("font-size", "15px")
          .style("font-weight", "bold")
          .text(d => formatCurrency(d.avgSalary))
          .transition().duration(500)
          .attr("x", d => Math.max(x(0) + 12, x(d.avgSalary) - 90));
        return g;
      },
      update => {
        update.interrupt().attr("opacity", 1); 
        
        update.select("rect").transition().duration(500)
          .attr("y", d => y(d.job))
          .attr("height", y.bandwidth())
          .attr("width", d => x(d.avgSalary) - x(0))
          .attr("fill", d => getJobColor(d.job)); 
          
        update.select(".bar-text").transition().duration(500)
          .attr("y", d => y(d.job) + y.bandwidth() / 2)
          .text(d => formatCurrency(d.avgSalary))
          .attr("x", d => Math.max(x(0) + 12, x(d.avgSalary) - 90));
        return update;
      },
      exit => exit.transition().duration(300).attr("opacity", 0).remove()
    );

  barSvg.select(".x-axis")
    .attr("transform", `translate(0,${margin.top + barData.length * (maxBarHeight + 20)})`)
    .transition().duration(500)
    .call(d3.axisBottom(x).ticks(5).tickFormat(d3.format("~s")))
    .selectAll("text")
    .style("font-size", "12px");

  barSvg.select(".y-axis")
    .attr("transform", `translate(${margin.left},0)`)
    .transition().duration(500)
    .call(d3.axisLeft(y).tickSizeOuter(0))
    .selectAll("text")
    .style("font-size", "14px")
    .style("font-weight", "bold")
    .style("fill", "#334155"); 
}

// ==========================================
// 绘制左侧主视图 (Sankey图)
// ==========================================
function drawSankey() {
  const container = d3.select(sankeyRef.value);
  const width = container.node().getBoundingClientRect().width || 1000;
  const height = 700; 
  
  container.selectAll("*").remove();

  let tooltip = d3.select("body").select(".custom-tooltip");
  if (tooltip.empty()) {
    tooltip = d3.select("body").append("div")
      .attr("class", "custom-tooltip")
      .style("opacity", 0);
  }

  const svg = container.append("svg")
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet")
    .attr("style", "font-family: sans-serif;");

  const mainGroup = svg.append("g");

  const sankeyGenerator = sankey()
    .nodeId(d => d.id)
    .nodeWidth(24) 
    .nodePadding(18) 
    .extent([[10, 10], [width - 10, height - 20]]);

  const jobCounts = d3.rollup(globalFilteredData, v => v.length, d => d.Job_Title || d[' Job_Title']); 
  const topJobsSet = new Set(Array.from(jobCounts).sort((a, b) => b[1] - a[1]).slice(0, 15).map(d => d[0]));
  
  const nodesMap = new Map();
  const linksMap = new Map();

  function getOrAddNode(name, category) {
    if(!name) name = "Unknown";
    const uniqueId = `${name}_${category}`;
    if (!nodesMap.has(uniqueId)) {
      nodesMap.set(uniqueId, { name, category, id: nodesMap.size });
    }
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

  const graphData = {
    nodes: Array.from(nodesMap.values()).sort((a, b) => a.id - b.id),
    links: Array.from(linksMap.values())
  };

  if (graphData.nodes.length === 0) return;

  const { nodes, links } = sankeyGenerator(graphData);

  const linkPath = mainGroup.append("g")
    .attr("fill", "none")
    .attr("stroke-opacity", 0.3)
    .selectAll("g")
    .data(links)
    .join("path")
    .attr("class", "link") 
    .attr("d", sankeyLinkHorizontal())
    .attr("stroke", d => getNodeColor(d.source))
    .attr("stroke-width", d => Math.max(1, d.width));
    
  const nodeGroup = mainGroup.append("g")
    .selectAll("g")
    .data(nodes)
    .join("g")
    .attr("class", "node"); 

  nodeGroup.append("rect")
    .attr("x", d => d.x0)
    .attr("y", d => d.y0)
    .attr("height", d => Math.max(1, d.y1 - d.y0)) 
    .attr("width", d => d.x1 - d.x0)
    .attr("fill", d => getNodeColor(d))
    .attr("stroke", "#000") 
    .attr("stroke-opacity", 0.1);

  nodeGroup.append("text")
    .attr("x", d => d.x0 < width / 2 ? d.x1 + 8 : d.x0 - 8)
    .attr("y", d => (d.y1 + d.y0) / 2)
    .attr("dy", "0.35em")
    .attr("text-anchor", d => d.x0 < width / 2 ? "start" : "end")
    .style("font", "13px sans-serif")
    .style("pointer-events", "none") 
    .text(d => d.name);

  // 多视图联动逻辑
  nodeGroup.on("mouseenter", function(event, d) {
    tooltip.transition().duration(50).style("opacity", 1);
    tooltip.html(`<strong style="font-size:15px; color:${getNodeColor(d)}">${d.name}</strong><br/>涉及数量: <b>${d.value}</b>`)
      .style("left", (event.pageX + 15) + "px")
      .style("top", (event.pageY - 15) + "px");

    linkPath.style("stroke-opacity", 0.05);
    nodeGroup.style("opacity", 0.3);
    d3.select(this).style("opacity", 1);
    linkPath.filter(l => l.source.id === d.id || l.target.id === d.id)
      .style("stroke-opacity", 0.75).style("stroke", "#e74c3c")
      .each(function(l) { nodeGroup.filter(n => n.id === l.source.id || n.id === l.target.id).style("opacity", 1); });

    let localSubset = globalFilteredData.filter(row => {
      let rawJob = row['Job_Title'] || row['Job Title'] || "Unknown";
      let jobName = topJobsSet.has(rawJob) ? rawJob : "Other Roles";
      if (d.category === 'Job') return jobName === d.name;
      if (d.category === 'Industry') return row['Industry'] === d.name;
      if (d.category === 'Risk') return (row['Automation_Risk'] || row['Automation Risk']) === d.name;
      return true;
    });

    barChartTitle.value = `【${d.name}】相关平均薪资`;
    drawBarChart(localSubset);
  })
  .on("mousemove", function(event) {
    tooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 15) + "px");
  })
  .on("mouseleave", function() {
    tooltip.transition().duration(200).style("opacity", 0);
    linkPath.style("stroke-opacity", 0.3).style("stroke", d => getNodeColor(d.source)); 
    nodeGroup.style("opacity", 1);
    
    barChartTitle.value = "大盘全局平均薪资 Top 5";
    drawBarChart(globalFilteredData);
  });

  linkPath.on("mouseenter", function(event, d) {
    tooltip.transition().duration(50).style("opacity", 1);
    tooltip.html(`
      <div style="font-size:13px; color:#666;">数据流向</div>
      <strong style="color:${getNodeColor(d.source)}">${d.source.name}</strong> ➔ <strong style="color:${getNodeColor(d.target)}">${d.target.name}</strong><br/>
      <div style="margin-top:4px;">岗位频次: <b style="font-size:15px">${d.value}</b></div>
    `).style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 15) + "px");
  })
  .on("mousemove", function(event) {
    tooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 15) + "px");
  })
  .on("mouseleave", function() {
    tooltip.transition().duration(200).style("opacity", 0);
  });

  nodeGroup.call(d3.drag()
    .subject(d => d)
    .on("start", function() { d3.select(this).raise(); svg.style("cursor", "grabbing"); })
    .on("drag", function(event, d) {
      const nodeHeight = d.y1 - d.y0; 
      d.y0 += event.dy;
      if (d.y0 < 0) d.y0 = 0;
      else if (d.y0 + nodeHeight > height) d.y0 = height - nodeHeight;
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
html, body {
  margin: 0 !important;
  padding: 0 !important;
  width: 100% !important;
  background-color: #f8fafc !important; 
  overflow-x: auto;
}

#app {
  max-width: 100% !important; 
  padding: 0 !important;      
  margin: 0 !important;
  width: 100% !important;
  display: block !important;  
}

.dashboard {
  max-width: 1600px; 
  min-width: 1200px; 
  margin: 0 auto;    
  padding: 30px;
  box-sizing: border-box;
}

.header-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.header-container h2 {
  margin: 0 0 5px 0;
  color: #0f172a;
  font-size: 26px;
}

.data-badge {
  display: inline-block;
  background-color: #e0f2fe;
  color: #0369a1;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 600;
}

.controls {
  background: white;
  padding: 12px 24px;
  border-radius: 8px;
  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
}

.controls select {
  padding: 8px 16px;
  font-size: 15px;
  border-radius: 6px;
  border: 1px solid #cbd5e1;
  outline: none;
  cursor: pointer;
}

.subtitle {
  color: #475569;
  font-size: 15px;
  margin-bottom: 25px;
}

.charts-layout {
  display: flex;
  flex-wrap: nowrap; 
  width: 100%;
  gap: 30px; 
  height: 750px; 
}

.sankey-card {
  flex: 6.5; 
  background: white;
  border-radius: 16px;
  box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05);
  padding: 25px;
  position: relative;
  min-width: 0; 
}

.bar-chart-card {
  flex: 3.5; 
  background: white;
  border-radius: 16px;
  box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05);
  padding: 25px;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.sankey-container, .bar-container {
  width: 100%;
  height: 100%;
}

.bar-title {
  margin: 0 0 15px 0;
  font-size: 18px;
  color: #1e293b;
  text-align: center;
  border-bottom: 2px solid #f1f5f9;
  padding-bottom: 15px;
}

.node, .link {
  transition: stroke-opacity 0.2s ease, stroke 0.2s ease, opacity 0.2s ease;
}

.node:hover { cursor: grab; }
.node:active { cursor: grabbing; }

.custom-tooltip {
  position: absolute;
  pointer-events: none; 
  background: rgba(255, 255, 255, 0.98);
  border: 1px solid #cbd5e1;
  box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1);
  padding: 16px 20px;
  border-radius: 10px;
  font-size: 14px;
  color: #0f172a;
  line-height: 1.6;
  z-index: 9999;
  backdrop-filter: blur(12px);
}

/* 🌟 新增：底部注释说明面板的样式 */
.annotations-card {
  margin-top: 30px;
  background: white;
  border-radius: 16px;
  box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05);
  padding: 25px 35px;
  display: flex;
  flex-direction: row;
  gap: 40px;
}

.annotation-section {
  flex: 1;
}

.annotation-section h4 {
  margin: 0 0 15px 0;
  color: #1e293b;
  font-size: 16px;
  display: flex;
  align-items: center;
}
.annotation-section ul {
  margin: 0;
  padding-left: 24px; /* 🌟 给黑圆点留出标准的物理空间 */
  list-style-type: disc; /* 🌟 明确保留经典的黑圆点 */
  color: #475569;
  font-size: 14px;
  line-height: 1.8;
  text-align: left !important; /* 🌟 强制左对齐！粉碎一切导致缝隙的居中效果 */
}

.annotation-section li {
  margin-bottom: 8px;
  text-align: left !important; /* 🌟 确保每一行文字死死靠左 */
}
</style>