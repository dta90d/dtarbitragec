#!/usr/bin/env perl

# Temporary help script.
# Written by dta90d.

use Modern::Perl '2014';
use JSON;

my $base = 'https://api.kraken.com/0/public/Ticker?pair=';

my $filename = '/home/deathtoall/w/BRAT/cryptocurrency-arbitrage-master/data/coin_dict';

open(my $file, '<', $filename);

my $buffer = "";
while(<$file>) {
    $buffer .= $_;
}
close($file);

my $data = decode_json $buffer;

open(my $res, '>', './urls.txt');

#my $url = $base;
my @result;
for my $key (keys %$data) {
    next unless $key =~ /kraken/;
    for my $coin (keys $data->{$key}) {
        my $url = $base . $coin;#.',';
        #say $url;
        system("echo $coin&&curl -G $url&&echo&&echo");
        #$coin = $data->{$key}->{$coin};
        #say $coin if grep {/$coin/} @result;
        #push @result, $coin unless grep {/$coin/} @result;
        #say $coin unless grep {/$coin/} @result;
    }
}
#say $res $_ for (@result);
#$url =~ s/,$//;
#system("curl -G $url&&echo&&echo");
close($res);
