/**
 * A wrapper for a query and a table visualization.
 * The object only requests 1 page + 1 row at a time, by default, in order
 * to minimize the amount of data held locally.
 * Table sorting and pagination is executed by issuing
 * additional requests with appropriate query parameters.
 * E.g., for getting the data sorted by column 'A' the following query is
 * attached to the request: 'tq=order by A'.
 *
 * Note: Discards query strings set by the user on the query object using
 * google.visualization.Query#setQuery.
 *
 * DISCLAIMER: This is an example code which you can copy and change as
 * required. It is used with the google visualization API table visualization
 * which is assumed to be loaded to the page. For more info see:
 * https://developers.google.com/chart/interactive/docs/gallery/table
 * https://developers.google.com/chart/interactive/docs/reference#Query
 */


/**
 * Constructs a new table query wrapper for the specified query, container
 * and tableOptions.
 *
 * Note: The wrapper clones the options object to adjust some of its properties.
 * In particular:
 *         sort {string} set to 'event'.
 *         page {string} set to 'event'.
 *         pageSize {Number} If number <= 0 set to 10.
 *         showRowNumber {boolean} set to true.
 *         firstRowNumber {number} set according to the current page.
 *         sortAscending {boolean} set according to the current sort.
 *         sortColumn {number} set according to the given sort.
 * @constructor
 */
var TableQueryWrapper = function (query, container, selectClause, whereClause, options) {

    var cssClassNames = {
        'headerRow': '',
        'tableRow': '',
        'oddTableRow': '',
        'selectedTableRow': '',
        'hoverTableRow': '',
        'headerCell': 'h5 text-center',
        'tableCell': 'h6',
        'rowNumberCell': 'text-center'
    };

    this.table = new google.visualization.Table(container);
    this.query = query;
    this.selectClause = selectClause;
    this.whereClause = whereClause;
    this.sortQueryClause = '';
    this.pageQueryClause = '';
    this.container = container;
    this.currentDataTable = null;

    var self = this;
    var addListener = google.visualization.events.addListener;
    addListener(this.table, 'page', function (e) { self.handlePage(e) });
    addListener(this.table, 'sort', function (e) { self.handleSort(e) });

    options = options || {};
    options = TableQueryWrapper.clone(options);

    options['sort'] = 'event';
    options['page'] = 'event';
    options['showRowNumber'] = true;
    options['allowHtml'] = true;
    options['cssClassNames'] = cssClassNames;
    options['width'] = '100%';
    options['height'] = '100%';
    var buttonConfig = 'pagingButtonsConfiguration';
    options[buttonConfig] = options[buttonConfig] || 'both';
    options['pageSize'] = (options['pageSize'] > 0) ? options['pageSize'] : 1000;
    this.pageSize = options['pageSize'];
    this.tableOptions = options;
    this.currentPageIndex = 0;
    this.setPageQueryClause(0);
};


/**
 * Sends the query and upon its return draws the Table visualization in the
 * container. If the query refresh interval is set then the visualization will
 * be redrawn upon each refresh.
 */
TableQueryWrapper.prototype.sendAndDraw = function () {
    this.query.abort();
    var queryClause = this.selectClause + ' ' + this.whereClause + ' ' + this.sortQueryClause + ' ' + this.pageQueryClause;
    //console.log(queryClause);

    this.query.setQuery(queryClause);
    this.table.setSelection([]);
    var self = this;
    this.query.send(function (response) { self.handleResponse(response) });
};

/** Handles the query response after a send returned by the data source. */
TableQueryWrapper.prototype.handleResponse = function (response) {
    this.currentDataTable = null;
    if (response.isError()) {
        google.visualization.errors.addError(this.container, response.getMessage(),
            response.getDetailedMessage(), { 'showInTooltip': false });
    } else {
        this.currentDataTable = response.getDataTable();


        var formatter = new google.visualization.PatternFormat(
            '<div class="show-only-if-exists text-center" style="visibility:hidden"><a class="btn btn-secondary" href="{0}"><i class="far fa-file"></i></a></div>');
        formatter.format(this.currentDataTable, [2]);

        var formatter2 = new google.visualization.PatternFormat(
            '<div class="show-only-if-exists text-center" style="visibility:hidden"><a class="btn btn-secondary" href="{0}"><i class="fas fa-link"></i></a></div>');
        formatter2.format(this.currentDataTable, [3]);

        //this.table.draw(this.currentDataTable, this.tableOptions);

        var view = new google.visualization.DataView(this.currentDataTable);

        if (this.whereClause.length > 0) {
            view.setColumns([0, 1, 2, 3]);
        }
        else {
            view.setColumns([0, 2, 3]);
        }

        this.table.draw(view, this.tableOptions);//{ allowHtml: true, showRowNumber: true, width: '100%', height: '80%' });

        var tags = document.getElementsByClassName('show-only-if-exists');
        for (var ii = 0; ii < tags.length; ii++) {
            if (tags[ii].getElementsByTagName('a')[0].getAttribute("href").length > 0) {
                tags[ii].style.visibility = "visible";
            }
        }
    }
};


/** Handles a sort event with the given properties. Will page to page=0. */
TableQueryWrapper.prototype.handleSort = function (properties) {
    var columnIndex = properties['column'];
    var isAscending = properties['ascending'];
    this.tableOptions['sortColumn'] = columnIndex;
    this.tableOptions['sortAscending'] = isAscending;
    // dataTable exists since the user clicked the table.
    var colID = this.currentDataTable.getColumnId(columnIndex);
    this.sortQueryClause = 'order by `' + colID + (!isAscending ? '` desc' : '`');
    // Calls sendAndDraw internally.
    this.handlePage({ 'page': 0 });
};


/** Handles a page event with the given properties. */
TableQueryWrapper.prototype.handlePage = function (properties) {
    var localTableNewPage = properties['page']; // 1, -1 or 0
    var newPage = 0;
    if (localTableNewPage != 0) {
        newPage = this.currentPageIndex + localTableNewPage;
    }
    if (this.setPageQueryClause(newPage)) {
        this.sendAndDraw();
    }
};


/**
 * Sets the pageQueryClause and table options for a new page request.
 * In case the next page is requested - checks that another page exists
 * based on the previous request.
 * Returns true if a new page query clause was set, false otherwise.
 */
TableQueryWrapper.prototype.setPageQueryClause = function (pageIndex) {
    var pageSize = this.pageSize;

    if (pageIndex < 0) {
        return false;
    }
    var dataTable = this.currentDataTable;
    if ((pageIndex == this.currentPageIndex + 1) && dataTable) {
        if (dataTable.getNumberOfRows() <= pageSize) {
            return false;
        }
    }
    this.currentPageIndex = pageIndex;
    var newStartRow = this.currentPageIndex * pageSize;
    // Get the pageSize + 1 so that we can know when the last page is reached.
    this.pageQueryClause = 'limit ' + (pageSize + 1) + ' offset ' + newStartRow;
    // Note: row numbers are 1-based yet dataTable rows are 0-based.
    this.tableOptions['firstRowNumber'] = newStartRow + 1;
    return true;
};


/** Performs a shallow clone of the given object. */
TableQueryWrapper.clone = function (obj) {
    var newObj = {};
    for (var key in obj) {
        newObj[key] = obj[key];
    }
    return newObj;
};