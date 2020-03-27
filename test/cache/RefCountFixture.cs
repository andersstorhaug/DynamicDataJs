﻿using System.Reactive.Linq;
using DynamicData.Tests.Domain;
using Xunit;
using System;
using System.Threading.Tasks;
using System.Linq;
using FluentAssertions;

namespace DynamicData.Tests.Cache
{

    public class RefCountFixture: IDisposable
    {
        let _source: ISourceCache<Person, string> & ISourceUpdater<Person, string>;

        public  RefCountFixture()
        {
            _source = updateable(new SourceCache<Person, string>((p => p.Key)));
        }

        afterEach(() => {
            _source.Dispose();
         });

        it('ChainIsInvokedOnceForMultipleSubscribers', () => {
            int created = 0;
            int disposals = 0;

            //Some expensive transform (or chain of operations)
            var longChain = _source.Connect()
                                   .Transform(p => p)
                                   .Do(_ => created++)
                                   .Finally(() => disposals++)
                                   .RefCount();

            var suscriber1 = longChain.Subscribe();
            var suscriber2 = longChain.Subscribe();
            var suscriber3 = longChain.Subscribe();

            _source.AddOrUpdate(new Person("Name", 10));
            suscriber1.Dispose();
            suscriber2.Dispose();
            suscriber3.Dispose();

            expect(created).toBe(1);
            expect(disposals).toBe(1);
        });        it('CanResubscribe', () => {
            int created = 0;
            int disposals = 0;

            //must have data so transform is invoked
            _source.AddOrUpdate(new Person("Name", 10));

            //Some expensive transform (or chain of operations)
            var longChain = _source.Connect()
                                   .Transform(p => p)
                                   .Do(_ => created++)
                                   .Finally(() => disposals++)
                                   .RefCount();

            var subscriber = longChain.Subscribe();
            subscriber.Dispose();

            subscriber = longChain.Subscribe();
            subscriber.Dispose();

            expect(created).toBe(2);
            expect(disposals).toBe(2);
        });        // This test is probabilistic, it could be cool to be able to prove RefCount's thread-safety
        // more accurately but I don't think that there is an easy way to do this.
        // At least this test can catch some bugs in the old implementation.
     //   [Fact]
        private async Task IsHopefullyThreadSafe()
        {
            var refCount = _source.Connect().RefCount();

            await Task.WhenAll(Enumerable.Range(0, 100).Select(_ =>
                Task.Run(() =>
                {
                    for (int i = 0; i < 1000; ++i)
                    {
                        var subscription = refCount.Subscribe();
                        subscription.Dispose();
                    }
                })));
        }
    }
}
