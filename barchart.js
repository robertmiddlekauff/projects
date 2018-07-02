import d3_selection_multi from 'd3-selection-multi/build/d3-selection-multi.js';

export const stackedBarChartTable = class StackedBarChartTable {
    constructor(selector, columns) {
        this.el = d3.select(selector);
        this.ul = this.el.append('ul');
        this.tooltip = this.el.append('div');
        this.columns = columns;
        this.chartColors = ['#2fa1f5', '#ff9b15', '#fe6565', '#ffc034'];
        this.cfDimension = {};
        this.cfGroup = {};
        this.chartData = [];
    }
    /**
    * Setup for chaining methods, D3 style
    */
    dimension(dimension) {
        this.cfDimension = dimension;
        return this;
    }
    group(group) {
        this.cfGroup = group;
        return this;
    }
    colors(colors) {
        this.chartColors = colors;
        return this;
    }
    /**
    * Preset helper methods for building the crossfilter dimension and group
    */
    static buildDimension(ndx) {
        return ndx.dimension(({ header, type }) => `${header},${type}`);
    }
    static buildGroup(dimension) {
        // https://github.com/crossfilter/crossfilter/wiki/API-Reference#group_reduce
        return dimension.group().reduce(
            // reduceAdd
            (p, v, nf) => {
                const obj = {
                    ...p[v.row],
                    ...{
                        [v.attributename]: v.eaches,
                        row: v.row,
                        header: v.header,
                        type: v.type
                    }
                };
                return [...p, obj]
            },
            // reduceRemove
            (p, v, nf) => p.filter(p => p.row !== v.row),
            // reduceInitial
            () => ([]),
        )
    }
    // Returns a hashmap of the chart's columns
    get columnsMap() {
        return this._generateColumnsMap();
    }
    _generateColumnsMap() {
        return this.columns.reduce((acc, col) => ({
            ...acc,
            ...{ [col]: 0 }
        }), {});
    }
    // Display a node's value as a percent
    _getPercent(d) {
        const num = d[0][1] - d[0][0];
        return `${Math.round(num * 100) || 0}%`;
    }
    // Sum a rows values
    _sumColumns(obj) {
        return Object.keys(obj).reduce((acc, key) => {
            if (this.columnsMap.hasOwnProperty(key)) {
                acc += obj[key];
            }
            return acc;
        }, 0);
    }
    render(data) {
        const barColorScale = d3.scaleOrdinal().range(this.chartColors);
        const dotColorScale = d3.scaleOrdinal().range(this.chartColors);
        const stack = d3.stack().offset(d3.stackOffsetExpand);
        /**
        * Labels list
        */
        const ul = this.ul
            .styles({
                'float': 'right',
                'margin-bottom': '20px',
                'list-style': 'none',
            })
            .attr('class', 'labels-container')
            .selectAll('li')
            .data(this.columns);
        ul.exit().remove();
        const li = ul
            .enter()
            .append('li')
            .styles({
                float: 'left',
                'margin-right': '10px',
            })
        li.append('span')
            .styles({
                width: '12px',
                height: '12px',
                display: 'inline-block',
                'margin': ' 0 5px 0 2px',
                'border-radius': '100%',
                'background-color': val => dotColorScale(val)
            })
        li.append('span')
            .text(d => d)

        /**
        * Tooltip setup
        */
        this.el.style('position', 'relative');
        this.tooltip
            .attr('class', 'chart-tooltip')
            .styles({
                display: 'none',
                position: 'absolute',
                'white-space': 'nowrap',
                background: '#f8f8fa',
                padding: '5px',
                border: '1px solid #e4e5ed',
            });

        /**
        * Main chart
        */
        const sectionTables = this.el.selectAll('table')
            // Update
            .data(() => this.cfGroup.map(({ key, value }) => {
                const [headerRowTitle, type] = key.split(',');
                const rows = value.map(row => ({ ...row, active: true, }));
                const headerRow = rows.reduce((acc, row) => {
                    Object.keys(row).forEach(key => {
                        if (this.columnsMap.hasOwnProperty(key)) {
                            acc[key] += row[key] || 0;
                        }
                    })
                    acc.header = row.header;
                    acc.row = headerRowTitle;
                    acc.active = true;
                    acc.type = type;
                    acc.count = rows.length;
                    return acc;
                }, this.columnsMap);
                return {
                    row: headerRowTitle,
                    type,
                    rows: [headerRow, ...rows]
                };
            }))
        // Exit
        sectionTables.exit().remove();
        // Enter
        const sectionTable = sectionTables
            .enter()
            .append('table')
            .attrs({
                width: () => '100%',
                class: 'horizontal-stacked-bar-chart',
            })
            .style('margin-bottom', '40px')

        const sectionHeader = sectionTable.append('tr')
        sectionHeader.append('th').text('Your utilizations');
        sectionHeader.append('th').text(d => d.type ? 'Total eaches' : '').style('text-align', 'right');
        sectionHeader.append('th').text('Unit market share');

        const row = sectionTable.selectAll(".row")
            .data(({ rows }) => {
                const foo = d3.nest()
                .key(function(d) {
                    return d.row
                })
                .rollup(v => {
                    return this.columns.reduce((acc, col) => {
                        acc[col] = d3.sum(v, d => d[col])
                        acc.active = true;
                        acc.type = v[0].type;
                        acc.count = v[0].count
                        return {...acc };
                    }, {});
                })
                .entries(rows)
                return foo;
            })
            .enter()
            .append('tr')
            .attr('class', 'chart-row')

        // First row, aka section header with drop down and summary info
        const descriptionTd = row.filter((d, i) => !i)
            .append('td')
        descriptionTd
            .append('i')
            .attr('class', 'section-toggle glyphicons glyphicons-chevron-down right-space-small semibold')
            .on('click', function(d, i) {
                d.value.active = !d.value.active;
                d3.select(this.closest('.horizontal-stacked-bar-chart'))
                    .selectAll('.chart-row')
                    .style('display', (d, i) => {
                        if (!i) return;
                        d.value.active = !d.value.active;
                        return d.value.active && i ? '' : 'none';
                    });
                d3.select(this).classed('glyphicons-chevron-down', d => d.value.active)
                d3.select(this).classed('glyphicons-chevron-right', d => !d.value.active)
            })
        const descriptionTdContainer = descriptionTd.append('div')
            .style('display', 'inline-block')
        descriptionTdContainer
            .append('span')
            .text(({ key }) => key)
            .style('font-weight', 'bold')
        descriptionTdContainer
            .append('div')
            .text(({ value }) => value.type ? `${value.type} ${String.fromCodePoint(0x2022)} ${value.count} facilities` : '')
            .attr('class', 'muted grey small')
            .style('line-height', '1em')


        // Additional rows
        row.filter((d, i) => i)
            .append('td')
            .html(({ key }) => key)

        row.append('td')
            .text(({ value }) => value.type ? this._sumColumns(value) : '')
            .attr('align', 'right');

        row.append('td')
            .attr('width', 500)
            .datum(({ value }) => stack.keys(this.columns)([value]))
            .selectAll('span')
            .data(obj => obj)
            .enter().append('span')
            .styles({
                width: obj => this._getPercent(obj),
                height: '35px',
                color: '#fff',
                'background-color': obj => barColorScale(obj.key),
                display: 'inline-block',
                'text-align': 'center',
                'line-height': '35px',
            })
            .on('mouseover', () => this.tooltip.style('display', 'block'))
            .on('mouseout', () => this.tooltip.style('display', 'none'))
            .on('mousemove', (d, i) => {
                const chart = this.el.node();
                const column = this.columns[i];
                // Count or percent depending on if looking at one provider or peers
                const eachesText = d[0].data.type ? d[0].data[column] : this._getPercent(d);
                const xPosition = d3.mouse(chart)[0] - 15;
                const yPosition = d3.mouse(chart)[1] - this.tooltip.node().offsetHeight - 5;
                this.tooltip.styles({
                    top: `${yPosition}px`,
                    left: `${xPosition}px`,
                });
                this.tooltip.text(`${column} eaches: ${eachesText}`);
            })
            .append('span')
            .text(obj => this._getPercent(obj))
            .style('visibility', function() {
                return this.offsetWidth + 5 > this.parentNode.offsetWidth ? 'hidden' : 'visible';
            });

        d3.selectAll('.horizontal-stacked-bar-chart th').styles({
            'border-bottom': '4px solid #d0d2e2',
            'vertical-align': 'bottom',
            'white-space': 'nowrap',
            'font-size': '14px',
        });
        d3.selectAll('.horizontal-stacked-bar-chart .chart-row td').styles({
            'border-bottom': '1px solid #d0d2e2',
            'vertical-align': 'middle',
            padding: '15px 10px',
        });
        d3.selectAll('.horizontal-stacked-bar-chart th:not(:last-of-type), .horizontal-stacked-bar-chart td:not(:last-of-type').styles({
            'padding-right': '50px'
        });
        d3.selectAll('.horizontal-stacked-bar-chart .section-toggle').styles({
            cursor: 'pointer',
            border: '2px solid #e4e5ed',
            padding: '5px',
            background: '#f8f8fa',
            'border-radius': '3px',
            'vertical-align': 'top',
        });
        return this;
    }
}
