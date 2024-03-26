import { Route } from '@/types';
import { load } from 'cheerio';
import got from '@/utils/got';
import cache from '@/utils/cache';
import iconv from 'iconv-lite';

export const route: Route = {
    path: '/:path/:page?',
    name: 'CCB CreditCard Notice',
    maintainers: ['rainorz'],
    handler,
};

async function handler(ctx) {
    const page = ctx.req.param('page') ?? '1';
    const baseUrl = 'http://creditcard3.ccb.com';
    const listUrl = `${baseUrl}/cn/creditcard/news/zxgg_${page}.html`;
    const response = await got(listUrl, {
        responseType: 'buffer',
    });

    const $ = load(iconv.decode(response.data, 'utf-8'));

    const list = $('ul.list li')
        .map((_, item) => {
            item = $(item);
            const notice = item.find('a');
            return {
                title: notice.text()?.replace('• ', ''),
                link: baseUrl + notice.attr('href'),
                pubDate: item.find('span').text(),
            };
        })
        .get();
    const items = await Promise.all(
        list.map((item) =>
            cache.tryGet(item.link, async () => {
                const detailResponse = await got(item.link, {
                    responseType: 'buffer',
                });

                const content = load(iconv.decode(detailResponse.data, 'utf-8'));
                const desc = content('.content');
                desc.find('h2').remove();
                item.description = desc.html();

                return item;
            })
        )
    );
    return {
        title: $('title').text(),
        link: listUrl,
        item: items,
    };
}
