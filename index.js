const merge = require("lodash/merge");

const getPage = (page) => parseInt(page) || 1;

const getLimit = (limit) => parseInt(limit);

const checkPaginator = async (page, limit, errorMessages) => {
  if (page <= 0) {
    return Promise.reject(errorMessages.page.min);
  }

  if (limit <= 0) {
    return Promise.reject(errorMessages.limit.min);
  }

  return Promise.resolve(true);
};

const getTotalDocs = async (self, pipeline) => {
  const [{ totalDocs = 0 } = {}] = await self.aggregate(pipeline).count("totalDocs");

  return totalDocs;
};

const loadSortInCursor = (cursor, sort) => {
  if (sort) {
    cursor._pipeline = [...cursor._pipeline, { $sort: sort }];
  }
};

const loadPaginatorInCursor = (cursor, page, limit) => {
  if (limit !== -1) {
    const currentPage = page - 1;

    cursor._pipeline = [
      ...cursor._pipeline,
      {
        $skip: currentPage === 0 ? 0 : currentPage * limit,
      },
      {
        $limit: limit,
      },
    ];
  }
};

const loadProjectInCursor = (cursor, project) => {
  if (project) {
    cursor._pipeline = [
      ...cursor._pipeline,
      {
        $project: project,
      },
    ];
  }
};

const getNextPage = (docsLength, page, limit) => {
  if (docsLength === limit) {
    return page + 1;
  }

  return null;
};

const getPrevPage = (page) => {
  const prevPage = page - 1;

  if (prevPage > 0) {
    return prevPage;
  }

  return null;
};

const getTotalPages = (totalDocs, limit) => Math.ceil(totalDocs / limit);

const defaultOptions = {
  customLabels: {
    totalDocs: "totalDocs",
    limit: "limit",
    page: "page",
    totalPages: "totalPages",
    docs: "docs",
    nextPage: "nextPage",
    prevPage: "prevPage",
    pagingCounter: "pagingCounter",
    hasPrevPage: "hasPrevPage",
    hasNextPage: "hasNextPage",
    meta: "paginator",
  },

  paginator: {
    limit: 12,
    page: 1,
  },

  project: null,
  sort: null,

  errorMessages: {
    page: {
      min: "El numero de pagina no puede ser menor a 1",
    },
    limit: {
      min: "El limite de pagina no puede ser menor a 1",
    },
  },
};

async function paginate(cursor, options) {
  options = merge(JSON.parse(JSON.stringify(defaultOptions)), paginate.options, options);

  const { paginator, sort, project, customLabels, errorMessages } = options;

  const page = getPage(paginator.page);
  const limit = getLimit(paginator.limit);

  await checkPaginator(page, limit, errorMessages);

  const promiseTotalDocs = getTotalDocs(this, cursor._pipeline);

  loadSortInCursor(cursor, sort);
  loadPaginatorInCursor(cursor, page, limit);
  loadProjectInCursor(cursor, project);

  const [totalDocs, docs] = await Promise.all([promiseTotalDocs, cursor]);

  const totalPages = getTotalPages(totalDocs, limit);
  const nextPage = getNextPage(docs.length, page, limit);
  const prevPage = getPrevPage(page);
  const hasNextPage = nextPage ? true : false;
  const hasPrevPage = prevPage ? true : false;

  const resultPaginator = {
    [customLabels.totalDocs]: totalDocs,
    [customLabels.limit]: limit,
    [customLabels.page]: page,
    [customLabels.totalPages]: totalPages,
    [customLabels.nextPage]: nextPage,
    [customLabels.prevPage]: prevPage,
    [customLabels.hasPrevPage]: hasPrevPage,
    [customLabels.hasNextPage]: hasNextPage,
  };

  if (customLabels.meta) {
    return {
      [customLabels.meta]: resultPaginator,
      [customLabels.docs]: docs,
    };
  }

  return {
    ...resultPaginator,
    [customLabels.docs]: docs,
  };
}

module.exports = (schema) => {
  schema.statics.paginate = paginate;
};

module.exports.paginate = paginate;
