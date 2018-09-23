#!/usr/bin/env perl

# create_lots_list.pl
# Written by dta90d on 2017.10.21.
#
# Create coin list from coin_dict list.

use Modern::Perl;
use autodie;

use JSON;
use LWP::Simple qw( get );

use Data::Dumper;


my $output   = JSON->new->canonical;
my $filename = '../../data/coin_dict';

open(my $coin_dict_file, '<', $filename);

my $buffer;
while(<$coin_dict_file>) {
    $buffer .= $_;
}
close($coin_dict_file);

my $coin_dict = decode_json $buffer;


my $response = get( "https://api.hitbtc.com/api/1/public/symbols" );

my $data = decode_json $response;

my %result;
for my $obj (@{ $data->{symbols} }) {
    next unless grep {/^$obj->{symbol}$/} keys %{ $coin_dict->{hitbtc} };
    $result{hitbtc}{ $coin_dict->{hitbtc}->{ $obj->{symbol} } } = $obj->{lot}*1;
}
my $lots = $output->encode( \%result );

my $space = ' ' x 4;
$lots =~ s/({|\[|,)/$1\n/g;
$lots =~ s/("\w+":)/$space$1/g;
$lots =~ s/(:)/$1 /g;
$lots =~ s/("\w+_\w+")/$space$1/g;
$lots =~ s/(\])/\n$space$1/g;
$lots =~ s/(})/$space$1/;
$lots =~ s/(\s*})/\n$1/g;
$lots =~ s/(_...")(:)/$1 $2/g;

open(my $res, '>', '../../data/lots');
say $res $lots;

close($res);
